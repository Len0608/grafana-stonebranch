import {
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataFrame,
  createDataFrame,
  FieldType,
  MetricFindValue,
  CoreApp,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';
import {
  UACQuery,
  UACDataSourceOptions,
  ParsedMetric,
  LabelFilter,
  AggregateFunction,
  DEFAULT_QUERY,
} from './types';

export class DataSource extends DataSourceApi<UACQuery, UACDataSourceOptions> {
  private metricsCache: { timestamp: number; data: ParsedMetric[] } | null = null;
  private readonly CACHE_TTL_MS = 2000;
  readonly instanceSettings: DataSourceInstanceSettings<UACDataSourceOptions>;
  private readonly proxyUrl: string;

  constructor(instanceSettings: DataSourceInstanceSettings<UACDataSourceOptions>) {
    super(instanceSettings);
    this.instanceSettings = instanceSettings;
    // instanceSettings.url is the Grafana data proxy URL when options.url is configured.
    // Fall back to explicit proxy URL if it is empty (e.g. pre-existing provisioned datasources).
    this.proxyUrl = instanceSettings.url || `/api/datasources/proxy/uid/${instanceSettings.uid}`;
  }

  getDefaultQuery(_app: CoreApp): Partial<UACQuery> {
    return DEFAULT_QUERY;
  }

  async fetchMetrics(): Promise<ParsedMetric[]> {
    const now = Date.now();
    if (this.metricsCache && now - this.metricsCache.timestamp < this.CACHE_TTL_MS) {
      return this.metricsCache.data;
    }

    const response = await lastValueFrom(
      getBackendSrv().fetch<string>({
        url: this.proxyUrl + '/metrics',
        responseType: 'text',
      })
    );

    const parsed = parsePrometheusText(String(response.data));
    this.metricsCache = { timestamp: now, data: parsed };
    return parsed;
  }

  async fetchMetricNames(): Promise<string[]> {
    const metrics = await this.fetchMetrics();
    return [...new Set(metrics.map((m) => m.name))].sort();
  }

  async query(request: DataQueryRequest<UACQuery>): Promise<DataQueryResponse> {
    const now = request.range?.to.valueOf() ?? Date.now();
    const metrics = await this.fetchMetrics();

    const data: DataFrame[] = [];
    for (const target of request.targets) {
      if (target.hide || !target.metric) {
        continue;
      }
      const frames = buildDataFrames(metrics, target, now);
      data.push(...frames);
    }

    return { data };
  }

  async metricFindQuery(query: string): Promise<MetricFindValue[]> {
    const metrics = await this.fetchMetrics();

    if (query === 'metrics') {
      const names = [...new Set(metrics.map((m) => m.name))].sort();
      return names.map((n) => ({ text: n, value: n }));
    }

    // label_values(metric_name, label_name)
    const lvMatch = query.match(/^label_values\(([^,]+),\s*([^)]+)\)$/);
    if (lvMatch) {
      const metricName = lvMatch[1].trim();
      const labelName = lvMatch[2].trim();
      const values = [
        ...new Set(
          metrics
            .filter((m) => m.name === metricName)
            .map((m) => m.labels[labelName])
            .filter((v): v is string => v !== undefined && v !== '')
        ),
      ].sort();
      return values.map((v) => ({ text: v, value: v }));
    }

    return [];
  }

  async testDatasource() {
    try {
      const metrics = await this.fetchMetrics();
      const ucMetrics = metrics.filter((m) => m.name.startsWith('uc_'));
      const buildInfo = metrics.find((m) => m.name === 'uc_build_info');
      const version = buildInfo?.labels['release'] ?? 'unknown';
      const agentCount = new Set(
        metrics.filter((m) => m.name === 'uc_agent_status').map((m) => m.labels['agent_id'])
      ).size;

      return {
        status: 'success' as const,
        message: `Connected to UAC ${version} · ${ucMetrics.length} UAC metrics · ${agentCount} agents`,
      };
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : String(e);
      // Include the proxy URL in the error to aid debugging
      if (e && typeof e === 'object' && 'status' in e) {
        const httpErr = e as { status: number; statusText?: string; data?: unknown };
        msg = `HTTP ${httpErr.status} ${httpErr.statusText ?? ''} — proxy: ${this.proxyUrl}/metrics`;
      }
      return {
        status: 'error' as const,
        message: `Connection failed [proxy: ${this.proxyUrl}/metrics]: ${msg}`,
      };
    }
  }
}

// ─── Prometheus text format parser ───────────────────────────────────────────

function parsePrometheusText(text: string): ParsedMetric[] {
  const results: ParsedMetric[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const braceIdx = trimmed.indexOf('{');
    const firstSpace = trimmed.indexOf(' ');

    let name: string;
    let labelsPart: string;
    let rest: string;

    if (braceIdx !== -1 && braceIdx < firstSpace) {
      name = trimmed.slice(0, braceIdx);
      const closeBrace = trimmed.indexOf('}', braceIdx);
      labelsPart = trimmed.slice(braceIdx + 1, closeBrace);
      rest = trimmed.slice(closeBrace + 1).trim();
    } else {
      name = trimmed.slice(0, firstSpace);
      labelsPart = '';
      rest = trimmed.slice(firstSpace + 1).trim();
    }

    const parts = rest.split(/\s+/);
    const value = parseFloat(parts[0]);
    if (isNaN(value)) {
      continue;
    }

    const timestamp = parts[1] ? parseInt(parts[1], 10) : null;
    const labels: Record<string, string> = {};

    if (labelsPart) {
      const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(labelsPart)) !== null) {
        labels[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
      }
    }

    results.push({ name, labels, value, timestamp });
  }

  return results;
}

// ─── DataFrame builder ────────────────────────────────────────────────────────

function matchesLabelFilter(labels: Record<string, string>, filters: LabelFilter[]): boolean {
  for (const f of filters) {
    const val = labels[f.key] ?? '';
    switch (f.op) {
      case '=':
        if (val !== f.value) { return false; }
        break;
      case '!=':
        if (val === f.value) { return false; }
        break;
      case '=~':
        if (!new RegExp(f.value).test(val)) { return false; }
        break;
      case '!~':
        if (new RegExp(f.value).test(val)) { return false; }
        break;
    }
  }
  return true;
}

function formatLegend(template: string, labels: Record<string, string>): string {
  if (!template) {
    const parts = Object.entries(labels)
      .filter(([, v]) => v !== '')
      .map(([k, v]) => `${k}="${v}"`);
    return parts.length ? parts.join(', ') : 'value';
  }
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => labels[key.trim()] ?? '');
}

function aggregateValues(values: number[], fn: AggregateFunction): number {
  if (values.length === 0) { return 0; }
  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'count':
      return values.length;
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return values[0];
  }
}

function buildDataFrames(metrics: ParsedMetric[], query: UACQuery, now: number): DataFrame[] {
  let filtered = metrics.filter(
    (m) =>
      m.name === query.metric &&
      matchesLabelFilter(m.labels, query.labelFilters ?? [])
  );

  // Optional value filter (e.g. keep only agent_status == 1)
  if (query.valueFilter) {
    const vf = query.valueFilter;
    filtered = filtered.filter((m) => {
      switch (vf.op) {
        case '=': return m.value === vf.value;
        case '!=': return m.value !== vf.value;
        case '>': return m.value > vf.value;
        case '<': return m.value < vf.value;
        case '>=': return m.value >= vf.value;
        case '<=': return m.value <= vf.value;
      }
      return true;
    });
  }

  if (filtered.length === 0) { return []; }

  const { aggregate = 'none', groupBy } = query;

  // Aggregation path
  if (aggregate !== 'none') {
    if (groupBy) {
      // Group by label, aggregate within each group
      const groups = new Map<string, number[]>();
      for (const m of filtered) {
        const key = m.labels[groupBy] ?? '(empty)';
        const arr = groups.get(key) ?? [];
        arr.push(m.value);
        groups.set(key, arr);
      }

      const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
      return [createDataFrame({
        refId: query.refId,
        fields: [
          { name: 'Time', type: FieldType.time, values: [now] },
          ...sortedGroups.map(([groupVal, values]) => ({
            name: groupVal,
            type: FieldType.number,
            values: [aggregateValues(values, aggregate)],
          })),
        ],
      })];
    }

    // Aggregate all into a single value
    const aggregated = aggregateValues(filtered.map((m) => m.value), aggregate);
    return [createDataFrame({
      refId: query.refId,
      fields: [
        { name: 'Time', type: FieldType.time, values: [now] },
        { name: query.metric, type: FieldType.number, values: [aggregated] },
      ],
    })];
  }

  // No aggregation: one field per series
  return [createDataFrame({
    refId: query.refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [now] },
      ...filtered.map((m) => ({
        name: formatLegend(query.legendFormat, m.labels),
        type: FieldType.number,
        values: [m.value],
        labels: m.labels,
      })),
    ],
  })];
}

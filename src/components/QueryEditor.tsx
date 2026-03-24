import React, { ChangeEvent, useEffect, useState } from 'react';
import {
  AsyncSelect,
  Button,
  HorizontalGroup,
  IconButton,
  InlineField,
  InlineFieldRow,
  Input,
  Select,
  Stack,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';
import { UACDataSourceOptions, UACQuery, LabelFilter, AggregateFunction } from '../types';

type Props = QueryEditorProps<DataSource, UACQuery, UACDataSourceOptions>;

const LABEL_OPS: Array<SelectableValue<LabelFilter['op']>> = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '=~', value: '=~' },
  { label: '!~', value: '!~' },
];

const AGGREGATE_OPTIONS: Array<SelectableValue<AggregateFunction>> = [
  { label: 'None', value: 'none' },
  { label: 'Sum', value: 'sum' },
  { label: 'Count', value: 'count' },
  { label: 'Avg', value: 'avg' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
];

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const {
    metric = '',
    labelFilters = [],
    legendFormat = '',
    aggregate = 'none',
    groupBy = '',
  } = query;

  // Load available label names for the selected metric
  const [labelNames, setLabelNames] = useState<string[]>([]);
  useEffect(() => {
    if (!metric) { return; }
    datasource.fetchMetrics().then((metrics) => {
      const names = [
        ...new Set(
          metrics
            .filter((m) => m.name === metric)
            .flatMap((m) => Object.keys(m.labels))
        ),
      ].sort();
      setLabelNames(names);
    });
  }, [metric, datasource]);

  const labelNameOptions = labelNames.map((n) => ({ label: n, value: n }));

  function update(patch: Partial<UACQuery>) {
    onChange({ ...query, ...patch });
  }

  function runQuery(patch: Partial<UACQuery>) {
    onChange({ ...query, ...patch });
    onRunQuery();
  }

  async function loadMetricOptions(inputValue: string): Promise<Array<SelectableValue<string>>> {
    const names = await datasource.fetchMetricNames();
    const filtered = inputValue
      ? names.filter((n) => n.toLowerCase().includes(inputValue.toLowerCase()))
      : names;
    return filtered.map((n) => ({ label: n, value: n }));
  }

  function addFilter() {
    update({ labelFilters: [...labelFilters, { key: '', op: '=', value: '' }] });
  }

  function removeFilter(idx: number) {
    const next = labelFilters.filter((_, i) => i !== idx);
    runQuery({ labelFilters: next });
  }

  function updateFilter(idx: number, patch: Partial<LabelFilter>) {
    const next = labelFilters.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    update({ labelFilters: next });
  }

  return (
    <Stack direction="column" gap={1}>
      {/* Metric selector */}
      <InlineFieldRow>
        <InlineField label="Metric" labelWidth={14} grow>
          <AsyncSelect
            loadOptions={loadMetricOptions}
            defaultOptions
            value={metric ? { label: metric, value: metric } : null}
            onChange={(v: SelectableValue<string>) => runQuery({ metric: v.value ?? '' })}
            placeholder="Select metric…"
            isClearable
          />
        </InlineField>
      </InlineFieldRow>

      {/* Label filters */}
      {labelFilters.map((filter, idx) => (
        <InlineFieldRow key={idx}>
          <InlineField label={idx === 0 ? 'Where' : ''} labelWidth={14}>
            <HorizontalGroup spacing="xs">
              <Select
                options={labelNameOptions}
                value={filter.key ? { label: filter.key, value: filter.key } : null}
                onChange={(v: SelectableValue<string>) => updateFilter(idx, { key: v.value ?? '' })}
                placeholder="label"
                width={16}
                allowCustomValue
              />
              <Select
                options={LABEL_OPS}
                value={filter.op}
                onChange={(v: SelectableValue<LabelFilter['op']>) => updateFilter(idx, { op: v.value ?? '=' })}
                width={8}
              />
              <Input
                value={filter.value}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateFilter(idx, { value: e.target.value })}
                onBlur={onRunQuery}
                placeholder="value"
                width={16}
              />
              <IconButton
                name="times"
                tooltip="Remove filter"
                onClick={() => removeFilter(idx)}
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
      ))}

      <InlineFieldRow>
        <InlineField labelWidth={14} label="">
          <Button variant="secondary" size="sm" icon="plus" onClick={addFilter}>
            Add filter
          </Button>
        </InlineField>
      </InlineFieldRow>

      {/* Aggregation */}
      <InlineFieldRow>
        <InlineField label="Aggregate" labelWidth={14} tooltip="Reduce all matching series to a single value">
          <Select
            options={AGGREGATE_OPTIONS}
            value={aggregate}
            onChange={(v: SelectableValue<AggregateFunction>) => runQuery({ aggregate: v.value ?? 'none' })}
            width={14}
          />
        </InlineField>
        {aggregate !== 'none' && (
          <InlineField label="Group by" labelWidth={10} tooltip="Group by label before aggregating">
            <Select
              options={[{ label: '(all)', value: '' }, ...labelNameOptions]}
              value={groupBy || ''}
              onChange={(v: SelectableValue<string>) => runQuery({ groupBy: v.value ?? '' })}
              width={18}
              isClearable
            />
          </InlineField>
        )}
      </InlineFieldRow>

      {/* Legend format */}
      <InlineFieldRow>
        <InlineField
          label="Legend"
          labelWidth={14}
          tooltip="Use {{label_name}} for label interpolation, e.g. {{task_instance_status}}"
        >
          <Input
            value={legendFormat}
            onChange={(e: ChangeEvent<HTMLInputElement>) => update({ legendFormat: e.target.value })}
            onBlur={onRunQuery}
            placeholder="{{label_name}}"
            width={32}
          />
        </InlineField>
      </InlineFieldRow>
    </Stack>
  );
}

import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export interface LabelFilter {
  key: string;
  op: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface ValueFilter {
  op: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: number;
}

export type AggregateFunction = 'none' | 'sum' | 'count' | 'avg' | 'min' | 'max';

export interface UACQuery extends DataQuery {
  metric: string;
  labelFilters: LabelFilter[];
  legendFormat: string;
  aggregate: AggregateFunction;
  groupBy?: string;
  valueFilter?: ValueFilter;
}

export const DEFAULT_QUERY: Partial<UACQuery> = {
  metric: '',
  labelFilters: [],
  legendFormat: '',
  aggregate: 'none',
};

export type AuthType = 'basic' | 'pat';

export interface UACDataSourceOptions extends DataSourceJsonData {
  url: string;
  authType: AuthType;
  username?: string;
}

export interface UACSecureJsonData {
  authorizationHeader?: string;
}

export interface ParsedMetric {
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp: number | null;
}

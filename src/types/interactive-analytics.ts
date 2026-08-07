// Interactive Analytics Types
import { Transaction } from '../types';

// Core Data Structures
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: LayoutConfiguration;
  filters: GlobalFilter[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  position: Position;
  size: Size;
  configuration: WidgetConfiguration;
  query: AnalyticsQuery;
  data?: ProcessedData;
}

export interface AnalyticsQuery {
  filters: Filter[];
  groupings: Grouping[];
  aggregations: Aggregation[];
  timeRange: TimeRange;
  sortBy?: SortConfiguration;
  limit?: number;
}

export interface ProcessedData {
  raw: any[];
  aggregated: AggregatedData;
  metadata: DataMetadata;
  statistics: SummaryStatistics;
}

export interface Filter {
  id: string;
  type: FilterType;
  field: string;
  operator: FilterOperator;
  value: any;
  enabled: boolean;
}

export interface Grouping {
  field: string;
  type: GroupingType;
  order: SortOrder;
}

export interface Aggregation {
  field: string;
  function: AggregationFunction;
  alias?: string;
}

// Enums and Types
export const WidgetType = {
  BAR_CHART: 'bar_chart',
  LINE_CHART: 'line_chart',
  PIE_CHART: 'pie_chart',
  TABLE: 'table',
  METRIC_CARD: 'metric_card',
  HEATMAP: 'heatmap'
} as const;

export type WidgetType = typeof WidgetType[keyof typeof WidgetType];

export const FilterType = {
  CATEGORY: 'category',
  PAYEE: 'payee',
  AMOUNT: 'amount',
  DATE: 'date',
  TAG: 'tag',
  CURRENCY: 'currency'
} as const;

export type FilterType = typeof FilterType[keyof typeof FilterType];

export const FilterOperator = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  BETWEEN: 'between',
  IN: 'in',
  NOT_IN: 'not_in'
} as const;

export type FilterOperator = typeof FilterOperator[keyof typeof FilterOperator];

export const AggregationFunction = {
  SUM: 'sum',
  AVERAGE: 'average',
  COUNT: 'count',
  MIN: 'min',
  MAX: 'max',
  MEDIAN: 'median'
} as const;

export type AggregationFunction = typeof AggregationFunction[keyof typeof AggregationFunction];

export const GroupingType = {
  EXACT: 'exact',
  DATE_MONTH: 'date_month',
  DATE_WEEK: 'date_week',
  DATE_DAY: 'date_day',
  AMOUNT_RANGE: 'amount_range'
} as const;

export type GroupingType = typeof GroupingType[keyof typeof GroupingType];

export const SortOrder = {
  ASC: 'asc',
  DESC: 'desc'
} as const;

export type SortOrder = typeof SortOrder[keyof typeof SortOrder];

export const ExportFormat = {
  PNG: 'png',
  SVG: 'svg',
  PDF: 'pdf',
  CSV: 'csv',
  JSON: 'json'
} as const;

export type ExportFormat = typeof ExportFormat[keyof typeof ExportFormat];

// Supporting Interfaces
export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface LayoutConfiguration {
  columns: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
}

export interface GlobalFilter extends Filter {
  appliesToWidgets: string[]; // Widget IDs this filter applies to
}

export interface WidgetConfiguration {
  chartOptions?: any; // ECharts options
  tableOptions?: TableOptions;
  metricOptions?: MetricOptions;
  colorScheme?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
}

export interface TableOptions {
  pageSize: number;
  sortable: boolean;
  searchable: boolean;
  columns: TableColumn[];
}

export interface TableColumn {
  field: string;
  title: string;
  width?: number;
  sortable?: boolean;
  formatter?: (value: any) => string;
}

export interface MetricOptions {
  format: 'currency' | 'number' | 'percentage';
  precision: number;
  showTrend?: boolean;
  trendPeriod?: 'day' | 'week' | 'month';
}

export interface TimeRange {
  start: Date;
  end: Date;
  preset?: TimeRangePreset;
}

export const TimeRangePreset = {
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_3_MONTHS: 'last_3_months',
  LAST_12_MONTHS: 'last_12_months',
  CUSTOM: 'custom'
} as const;

export type TimeRangePreset = typeof TimeRangePreset[keyof typeof TimeRangePreset];

export const DimensionType = {
  CATEGORICAL: 'categorical',
  NUMERICAL: 'numerical',
  TEMPORAL: 'temporal',
  BOOLEAN: 'boolean'
} as const;

export type DimensionType = typeof DimensionType[keyof typeof DimensionType];

// Drop Zone Types
export const DropZoneType = {
  GROUP_BY: 'group_by',
  FILTER_BY: 'filter_by',
  AGGREGATE_BY: 'aggregate_by'
} as const;

export type DropZoneType = typeof DropZoneType[keyof typeof DropZoneType];

export interface SortConfiguration {
  field: string;
  order: SortOrder;
}

export interface AggregatedData {
  [key: string]: {
    value: number;
    count: number;
    percentage?: number;
    trend?: number;
  };
}

export interface DataMetadata {
  totalRecords: number;
  filteredRecords: number;
  dateRange: TimeRange;
  categories: string[];
  payees: string[];
  currencies: string[];
}

export interface SummaryStatistics {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  averageTransaction: number;
  transactionCount: number;
  topCategories: Array<{ category: string; amount: number; percentage: number }>;
  topPayees: Array<{ payee: string; amount: number; count: number }>;
}

// Data Dimension for Drag and Drop
export interface DataDimension {
  id: string;
  name: string;
  field: string;
  type: DimensionType;
  icon?: string;
  description?: string;
}

export interface DropZone {
  id: string;
  type: DropZoneType;
  title: string;
  acceptedTypes: DimensionType[];
  maxItems?: number;
  items: DataDimension[];
}

// Quick Filters
export interface QuickFilter {
  id: string;
  name: string;
  description: string;
  icon?: string;
  filter: Filter;
}

// Dashboard Management
export interface DashboardSummary {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  widgetCount: number;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  widgets: Omit<Widget, 'id' | 'data'>[];
  layout: LayoutConfiguration;
}

// Storage and Export
export interface StorageUsage {
  used: number;
  total: number;
  percentage: number;
  dashboardCount: number;
}

export interface ConfigurationBackup {
  version: string;
  timestamp: Date;
  dashboards: Dashboard[];
  templates: DashboardTemplate[];
  settings: any;
}

// Validation and Error Handling
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// Chart Instance (for ECharts integration)
export interface ChartInstance {
  id: string;
  type: WidgetType;
  echartInstance: any; // ECharts instance
  configuration: WidgetConfiguration;
  data: ProcessedData;
}

// Component Interfaces
export interface DashboardManagerInterface {
  createDashboard(name: string, template?: DashboardTemplate): Dashboard;
  saveDashboard(dashboard: Dashboard): Promise<void>;
  loadDashboard(id: string): Promise<Dashboard>;
  deleteDashboard(id: string): Promise<void>;
  listDashboards(): Promise<DashboardSummary[]>;
  exportDashboard(id: string, format: ExportFormat): Promise<Blob>;
  importDashboard(file: File): Promise<Dashboard>;
}

export interface QueryBuilderInterface {
  dimensions: DataDimension[];
  filters: Filter[];
  groupings: Grouping[];
  aggregations: Aggregation[];
  
  addDimension(dimension: DataDimension, zone: DropZoneType): void;
  removeDimension(dimension: DataDimension, zone: DropZoneType): void;
  updateConfiguration(config: AnalyticsQuery): void;
  validateQuery(): ValidationResult;
}

export interface FilterEngineInterface {
  applyFilters(transactions: Transaction[], filters: Filter[]): Transaction[];
  createFilter(type: FilterType, configuration: any): Filter;
  combineFilters(filters: Filter[], logic: 'AND' | 'OR'): Filter;
  getQuickFilters(): QuickFilter[];
  validateFilter(filter: Filter): ValidationResult;
}

export interface VisualizationEngineInterface {
  renderChart(data: ProcessedData, config: WidgetConfiguration): ChartInstance;
  updateChart(chart: ChartInstance, data: ProcessedData): void;
  exportChart(chart: ChartInstance, format: ExportFormat): Promise<Blob>;
  getAvailableChartTypes(data: ProcessedData): WidgetType[];
  validateChartConfig(config: WidgetConfiguration): ValidationResult;
}

export interface DataProcessorInterface {
  processTransactions(transactions: Transaction[], query: AnalyticsQuery): ProcessedData;
  aggregateData(data: Transaction[], groupBy: string[], aggregateBy: AggregationFunction): AggregatedData;
  calculateTimeSeriesData(transactions: Transaction[], timeRange: TimeRange): any[];
  generateSummaryStatistics(data: ProcessedData): SummaryStatistics;
}

export interface StorageManagerInterface {
  saveDashboard(dashboard: Dashboard): Promise<void>;
  loadDashboard(id: string): Promise<Dashboard | null>;
  listDashboards(): Promise<DashboardSummary[]>;
  deleteDashboard(id: string): Promise<void>;
  getStorageUsage(): StorageUsage;
  cleanupStorage(): Promise<void>;
  exportConfiguration(): Promise<ConfigurationBackup>;
  importConfiguration(backup: ConfigurationBackup): Promise<void>;
}
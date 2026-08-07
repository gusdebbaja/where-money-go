// Filter Engine for Interactive Analytics
import { Transaction } from '../types';
import { 
  Filter, 
  FilterType, 
  FilterOperator, 
  QuickFilter, 
  ValidationResult,
  ValidationError,
  TimeRangePreset
} from '../types/interactive-analytics';

export class FilterEngine {
  /**
   * Apply multiple filters to transactions
   */
  applyFilters(transactions: Transaction[], filters: Filter[]): Transaction[] {
    return transactions.filter(transaction => {
      return filters.every(filter => {
        if (!filter.enabled) return true;
        return this.evaluateFilter(transaction, filter);
      });
    });
  }

  /**
   * Create a filter with appropriate configuration
   */
  createFilter(type: FilterType, configuration: any): Filter {
    const baseFilter: Filter = {
      id: `filter_${type}_${Date.now()}`,
      type,
      field: this.getFieldForFilterType(type),
      operator: this.getDefaultOperatorForType(type),
      value: configuration.value || null,
      enabled: true
    };

    // Apply type-specific configurations
    switch (type) {
      case FilterType.AMOUNT:
        if (configuration.min !== undefined && configuration.max !== undefined) {
          baseFilter.operator = FilterOperator.BETWEEN;
          baseFilter.value = [configuration.min, configuration.max];
        } else if (configuration.min !== undefined) {
          baseFilter.operator = FilterOperator.GREATER_THAN;
          baseFilter.value = configuration.min;
        } else if (configuration.max !== undefined) {
          baseFilter.operator = FilterOperator.LESS_THAN;
          baseFilter.value = configuration.max;
        }
        break;

      case FilterType.DATE:
        if (configuration.preset) {
          const dateRange = this.getDateRangeForPreset(configuration.preset);
          baseFilter.operator = FilterOperator.BETWEEN;
          baseFilter.value = [dateRange.start, dateRange.end];
        } else if (configuration.start && configuration.end) {
          baseFilter.operator = FilterOperator.BETWEEN;
          baseFilter.value = [new Date(configuration.start), new Date(configuration.end)];
        }
        break;

      case FilterType.CATEGORY:
      case FilterType.PAYEE:
      case FilterType.TAG:
        if (Array.isArray(configuration.values)) {
          baseFilter.operator = FilterOperator.IN;
          baseFilter.value = configuration.values;
        } else if (configuration.value) {
          baseFilter.operator = FilterOperator.CONTAINS;
          baseFilter.value = configuration.value;
        }
        break;
    }

    return baseFilter;
  }

  /**
   * Combine multiple filters with AND/OR logic
   */
  combineFilters(filters: Filter[], logic: 'AND' | 'OR' = 'AND'): Filter {
    if (filters.length === 0) {
      throw new Error('Cannot combine empty filter array');
    }

    if (filters.length === 1) {
      return filters[0];
    }

    // For now, we'll create a composite filter that represents the combination
    // In a more complex implementation, this could be a separate CompositeFilter type
    return {
      id: `combined_${Date.now()}`,
      type: FilterType.CATEGORY, // Placeholder
      field: 'combined',
      operator: FilterOperator.EQUALS,
      value: { filters, logic },
      enabled: true
    };
  }

  /**
   * Get predefined quick filters
   */
  getQuickFilters(): QuickFilter[] {
    return [
      {
        id: 'expenses_only',
        name: 'Expenses Only',
        description: 'Show only expense transactions (negative amounts)',
        icon: 'TrendingDown',
        filter: {
          id: 'expenses_filter',
          type: FilterType.AMOUNT,
          field: 'amount',
          operator: FilterOperator.LESS_THAN,
          value: 0,
          enabled: true
        }
      },
      {
        id: 'income_only',
        name: 'Income Only',
        description: 'Show only income transactions (positive amounts)',
        icon: 'TrendingUp',
        filter: {
          id: 'income_filter',
          type: FilterType.AMOUNT,
          field: 'amount',
          operator: FilterOperator.GREATER_THAN,
          value: 0,
          enabled: true
        }
      },
      {
        id: 'subscriptions',
        name: 'Subscriptions',
        description: 'Show only subscription transactions',
        icon: 'Repeat',
        filter: {
          id: 'subscriptions_filter',
          type: FilterType.TAG,
          field: 'tags',
          operator: FilterOperator.CONTAINS,
          value: 'subscription',
          enabled: true
        }
      },
      {
        id: 'large_transactions',
        name: 'Large Transactions',
        description: 'Show transactions above $500',
        icon: 'DollarSign',
        filter: {
          id: 'large_filter',
          type: FilterType.AMOUNT,
          field: 'amount',
          operator: FilterOperator.GREATER_THAN,
          value: 500,
          enabled: true
        }
      },
      {
        id: 'recent_activity',
        name: 'Recent Activity',
        description: 'Show transactions from the last 7 days',
        icon: 'Clock',
        filter: {
          id: 'recent_filter',
          type: FilterType.DATE,
          field: 'date',
          operator: FilterOperator.GREATER_THAN,
          value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          enabled: true
        }
      },
      {
        id: 'uncategorized',
        name: 'Uncategorized',
        description: 'Show transactions without assigned categories',
        icon: 'HelpCircle',
        filter: {
          id: 'uncategorized_filter',
          type: FilterType.CATEGORY,
          field: 'category',
          operator: FilterOperator.EQUALS,
          value: null,
          enabled: true
        }
      }
    ];
  }

  /**
   * Validate a filter configuration
   */
  validateFilter(filter: Filter): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: any[] = [];

    // Check required fields
    if (!filter.id) {
      errors.push({
        field: 'id',
        message: 'Filter ID is required',
        code: 'MISSING_ID'
      });
    }

    if (!filter.type) {
      errors.push({
        field: 'type',
        message: 'Filter type is required',
        code: 'MISSING_TYPE'
      });
    }

    if (!filter.field) {
      errors.push({
        field: 'field',
        message: 'Filter field is required',
        code: 'MISSING_FIELD'
      });
    }

    if (!filter.operator) {
      errors.push({
        field: 'operator',
        message: 'Filter operator is required',
        code: 'MISSING_OPERATOR'
      });
    }

    // Validate operator compatibility with type
    if (filter.type && filter.operator) {
      const validOperators = this.getValidOperatorsForType(filter.type);
      if (!validOperators.includes(filter.operator)) {
        errors.push({
          field: 'operator',
          message: `Operator ${filter.operator} is not valid for type ${filter.type}`,
          code: 'INVALID_OPERATOR'
        });
      }
    }

    // Validate value based on operator
    if (filter.operator === FilterOperator.BETWEEN) {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) {
        errors.push({
          field: 'value',
          message: 'BETWEEN operator requires an array of two values',
          code: 'INVALID_BETWEEN_VALUE'
        });
      }
    }

    if (filter.operator === FilterOperator.IN || filter.operator === FilterOperator.NOT_IN) {
      if (!Array.isArray(filter.value)) {
        errors.push({
          field: 'value',
          message: 'IN/NOT_IN operators require an array value',
          code: 'INVALID_ARRAY_VALUE'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get available filter options for a specific field
   */
  getFilterOptions(transactions: Transaction[], field: string): any[] {
    const uniqueValues = new Set<any>();

    transactions.forEach(transaction => {
      const value = this.getFieldValue(transaction, field);
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => uniqueValues.add(v));
        } else {
          uniqueValues.add(value);
        }
      }
    });

    return Array.from(uniqueValues).sort();
  }

  /**
   * Get statistics for a field to help with filter configuration
   */
  getFieldStatistics(transactions: Transaction[], field: string): any {
    const values = transactions
      .map(t => this.getFieldValue(t, field))
      .filter(v => v !== null && v !== undefined && !Array.isArray(v))
      .map(v => Number(v))
      .filter(v => !isNaN(v));

    if (values.length === 0) {
      return { min: 0, max: 0, average: 0, count: 0 };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      count: values.length
    };
  }

  // Private helper methods

  private evaluateFilter(transaction: Transaction, filter: Filter): boolean {
    const fieldValue = this.getFieldValue(transaction, filter.field);
    
    switch (filter.operator) {
      case FilterOperator.EQUALS:
        if (filter.value === null) {
          return fieldValue === null || fieldValue === undefined || fieldValue === '';
        }
        return fieldValue === filter.value;
      
      case FilterOperator.NOT_EQUALS:
        if (filter.value === null) {
          return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
        }
        return fieldValue !== filter.value;
      
      case FilterOperator.CONTAINS:
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v => String(v).toLowerCase().includes(String(filter.value).toLowerCase()));
        }
        return String(fieldValue || '').toLowerCase().includes(String(filter.value).toLowerCase());
      
      case FilterOperator.NOT_CONTAINS:
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some(v => String(v).toLowerCase().includes(String(filter.value).toLowerCase()));
        }
        return !String(fieldValue || '').toLowerCase().includes(String(filter.value).toLowerCase());
      
      case FilterOperator.GREATER_THAN:
        if (fieldValue instanceof Date && filter.value instanceof Date) {
          return fieldValue.getTime() > filter.value.getTime();
        }
        return Number(fieldValue) > Number(filter.value);
      
      case FilterOperator.LESS_THAN:
        if (fieldValue instanceof Date && filter.value instanceof Date) {
          return fieldValue.getTime() < filter.value.getTime();
        }
        return Number(fieldValue) < Number(filter.value);
      
      case FilterOperator.BETWEEN:
        if (Array.isArray(filter.value) && filter.value.length === 2) {
          if (fieldValue instanceof Date) {
            const start = filter.value[0] instanceof Date ? filter.value[0].getTime() : new Date(filter.value[0]).getTime();
            const end = filter.value[1] instanceof Date ? filter.value[1].getTime() : new Date(filter.value[1]).getTime();
            return fieldValue.getTime() >= start && fieldValue.getTime() <= end;
          }
          const numValue = Number(fieldValue);
          return numValue >= Number(filter.value[0]) && numValue <= Number(filter.value[1]);
        }
        return false;
      
      case FilterOperator.IN:
        if (Array.isArray(filter.value)) {
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(v => filter.value.includes(v));
          }
          return filter.value.includes(fieldValue);
        }
        return false;
      
      case FilterOperator.NOT_IN:
        if (Array.isArray(filter.value)) {
          if (Array.isArray(fieldValue)) {
            return !fieldValue.some(v => filter.value.includes(v));
          }
          return !filter.value.includes(fieldValue);
        }
        return true;
      
      default:
        return true;
    }
  }

  private getFieldValue(transaction: Transaction, field: string): any {
    switch (field) {
      case 'category':
        return transaction.category || null;
      case 'payee':
        return transaction.payee;
      case 'amount':
        return transaction.amount;
      case 'date':
        return transaction.date;
      case 'tags':
        return transaction.tags;
      case 'currency':
        return transaction.currency || 'USD';
      case 'type':
        return transaction.type;
      case 'description':
        return transaction.description || '';
      case 'isSaving':
        return transaction.isSaving || false;
      default:
        return null;
    }
  }

  private getFieldForFilterType(type: FilterType): string {
    switch (type) {
      case FilterType.CATEGORY:
        return 'category';
      case FilterType.PAYEE:
        return 'payee';
      case FilterType.AMOUNT:
        return 'amount';
      case FilterType.DATE:
        return 'date';
      case FilterType.TAG:
        return 'tags';
      case FilterType.CURRENCY:
        return 'currency';
      default:
        return 'category';
    }
  }

  private getDefaultOperatorForType(type: FilterType): FilterOperator {
    switch (type) {
      case FilterType.AMOUNT:
        return FilterOperator.GREATER_THAN;
      case FilterType.DATE:
        return FilterOperator.BETWEEN;
      case FilterType.CATEGORY:
      case FilterType.PAYEE:
      case FilterType.CURRENCY:
        return FilterOperator.EQUALS;
      case FilterType.TAG:
        return FilterOperator.CONTAINS;
      default:
        return FilterOperator.EQUALS;
    }
  }

  private getValidOperatorsForType(type: FilterType): FilterOperator[] {
    switch (type) {
      case FilterType.AMOUNT:
        return [
          FilterOperator.EQUALS,
          FilterOperator.NOT_EQUALS,
          FilterOperator.GREATER_THAN,
          FilterOperator.LESS_THAN,
          FilterOperator.BETWEEN
        ];
      
      case FilterType.DATE:
        return [
          FilterOperator.EQUALS,
          FilterOperator.GREATER_THAN,
          FilterOperator.LESS_THAN,
          FilterOperator.BETWEEN
        ];
      
      case FilterType.CATEGORY:
      case FilterType.PAYEE:
      case FilterType.CURRENCY:
        return [
          FilterOperator.EQUALS,
          FilterOperator.NOT_EQUALS,
          FilterOperator.CONTAINS,
          FilterOperator.NOT_CONTAINS,
          FilterOperator.IN,
          FilterOperator.NOT_IN
        ];
      
      case FilterType.TAG:
        return [
          FilterOperator.CONTAINS,
          FilterOperator.NOT_CONTAINS,
          FilterOperator.IN,
          FilterOperator.NOT_IN
        ];
      
      default:
        return [FilterOperator.EQUALS];
    }
  }

  private getDateRangeForPreset(preset: TimeRangePreset): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start: Date;

    switch (preset) {
      case TimeRangePreset.LAST_7_DAYS:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      
      case TimeRangePreset.LAST_30_DAYS:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      
      case TimeRangePreset.LAST_3_MONTHS:
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        break;
      
      case TimeRangePreset.LAST_12_MONTHS:
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }
}

// Export singleton instance
export const filterEngine = new FilterEngine();
// Data Processor for Interactive Analytics
import { Transaction } from '../types';
import { 
  AnalyticsQuery, 
  ProcessedData, 
  AggregatedData, 
  SummaryStatistics, 
  DataMetadata,
  AggregationFunction,
  GroupingType,
  TimeRange,
  Filter,
  FilterOperator
} from '../types/interactive-analytics';

export class DataProcessor {
  /**
   * Process transactions according to the analytics query
   */
  processTransactions(transactions: Transaction[], query: AnalyticsQuery): ProcessedData {
    // First, filter out transactions tagged with "Exclude"
    const analyticsTransactions = transactions.filter(t => 
      !t.tags || !t.tags.some(tag => tag.toLowerCase() === 'exclude')
    );

    // Apply filters first
    let filteredTransactions = this.applyFilters(analyticsTransactions, query.filters);
    
    // Apply time range filter
    if (query.timeRange) {
      filteredTransactions = this.applyTimeRangeFilter(filteredTransactions, query.timeRange);
    }

    // Generate aggregated data based on groupings
    const aggregated = this.aggregateData(
      filteredTransactions, 
      query.groupings.map(g => g.field),
      query.aggregations.length > 0 ? query.aggregations[0].function : AggregationFunction.SUM
    );

    // Generate metadata
    const metadata = this.generateMetadata(filteredTransactions, analyticsTransactions, query.timeRange);

    // Generate summary statistics
    const statistics = this.generateSummaryStatistics(filteredTransactions);

    return {
      raw: filteredTransactions,
      aggregated,
      metadata,
      statistics
    };
  }

  /**
   * Apply filters to transactions
   */
  private applyFilters(transactions: Transaction[], filters: Filter[]): Transaction[] {
    return transactions.filter(transaction => {
      return filters.every(filter => {
        if (!filter.enabled) return true;
        return this.evaluateFilter(transaction, filter);
      });
    });
  }

  /**
   * Evaluate a single filter against a transaction
   */
  private evaluateFilter(transaction: Transaction, filter: Filter): boolean {
    const fieldValue = this.getFieldValue(transaction, filter.field);
    
    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return fieldValue === filter.value;
      
      case FilterOperator.NOT_EQUALS:
        return fieldValue !== filter.value;
      
      case FilterOperator.CONTAINS:
        return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
      
      case FilterOperator.NOT_CONTAINS:
        return !String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
      
      case FilterOperator.GREATER_THAN:
        return Number(fieldValue) > Number(filter.value);
      
      case FilterOperator.LESS_THAN:
        return Number(fieldValue) < Number(filter.value);
      
      case FilterOperator.BETWEEN:
        if (Array.isArray(filter.value) && filter.value.length === 2) {
          const numValue = Number(fieldValue);
          return numValue >= Number(filter.value[0]) && numValue <= Number(filter.value[1]);
        }
        return false;
      
      case FilterOperator.IN:
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      
      case FilterOperator.NOT_IN:
        return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
      
      default:
        return true;
    }
  }

  /**
   * Get field value from transaction
   */
  private getFieldValue(transaction: Transaction, field: string): any {
    switch (field) {
      case 'category':
        return transaction.category || 'Uncategorized';
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
      default:
        return null;
    }
  }

  /**
   * Apply time range filter
   */
  private applyTimeRangeFilter(transactions: Transaction[], timeRange: TimeRange): Transaction[] {
    return transactions.filter(transaction => {
      const txnDate = transaction.date.getTime();
      return txnDate >= timeRange.start.getTime() && txnDate <= timeRange.end.getTime();
    });
  }

  /**
   * Aggregate data by specified fields and aggregation function
   */
  aggregateData(
    transactions: Transaction[], 
    groupByFields: string[], 
    aggregateBy: AggregationFunction = AggregationFunction.SUM
  ): AggregatedData {
    if (groupByFields.length === 0) {
      // No grouping - return single aggregate
      return {
        'Total': {
          value: this.calculateAggregation(transactions, 'amount', aggregateBy),
          count: transactions.length,
          percentage: 100
        }
      };
    }

    // Group transactions by the specified fields
    const groups = this.groupTransactions(transactions, groupByFields);
    const result: AggregatedData = {};
    const totalValue = Math.abs(this.calculateAggregation(transactions, 'amount', AggregationFunction.SUM));

    Object.entries(groups).forEach(([groupKey, groupTransactions]) => {
      const value = this.calculateAggregation(groupTransactions, 'amount', aggregateBy);
      const percentage = totalValue > 0 ? (Math.abs(value) / totalValue) * 100 : 0;
      
      result[groupKey] = {
        value,
        count: groupTransactions.length,
        percentage
      };
    });

    return result;
  }

  /**
   * Group transactions by specified fields
   */
  private groupTransactions(transactions: Transaction[], groupByFields: string[]): Record<string, Transaction[]> {
    const groups: Record<string, Transaction[]> = {};

    transactions.forEach(transaction => {
      const groupKey = groupByFields.map(field => {
        const value = this.getFieldValue(transaction, field);
        
        // Handle date grouping
        if (field === 'date' && value instanceof Date) {
          return this.formatDateForGrouping(value, GroupingType.DATE_MONTH);
        }
        
        // Handle array fields (like tags)
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(', ') : 'None';
        }
        
        return String(value || 'Unknown');
      }).join(' | ');

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(transaction);
    });

    return groups;
  }

  /**
   * Format date for grouping based on grouping type
   */
  private formatDateForGrouping(date: Date, groupingType: GroupingType): string {
    switch (groupingType) {
      case GroupingType.DATE_DAY:
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      case GroupingType.DATE_WEEK:
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `Week of ${weekStart.toISOString().split('T')[0]}`;
      
      case GroupingType.DATE_MONTH:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * Calculate aggregation value
   */
  private calculateAggregation(
    transactions: Transaction[], 
    field: string, 
    aggregationFunction: AggregationFunction
  ): number {
    if (transactions.length === 0) return 0;

    const values = transactions.map(t => Number(this.getFieldValue(t, field)) || 0);

    switch (aggregationFunction) {
      case AggregationFunction.SUM:
        return values.reduce((sum, val) => sum + val, 0);
      
      case AggregationFunction.AVERAGE:
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      
      case AggregationFunction.COUNT:
        return transactions.length;
      
      case AggregationFunction.MIN:
        return Math.min(...values);
      
      case AggregationFunction.MAX:
        return Math.max(...values);
      
      case AggregationFunction.MEDIAN:
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2 
          : sorted[mid];
      
      default:
        return 0;
    }
  }

  /**
   * Calculate time series data for line charts
   */
  calculateTimeSeriesData(transactions: Transaction[], timeRange: TimeRange): any[] {
    // Determine appropriate granularity based on time range
    const daysDiff = Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24));
    let granularity: GroupingType;
    
    if (daysDiff <= 31) {
      granularity = GroupingType.DATE_DAY;
    } else if (daysDiff <= 90) {
      granularity = GroupingType.DATE_WEEK;
    } else {
      granularity = GroupingType.DATE_MONTH;
    }

    // Group transactions by time period
    const timeGroups: Record<string, Transaction[]> = {};
    
    transactions.forEach(transaction => {
      const timeKey = this.formatDateForGrouping(transaction.date, granularity);
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = [];
      }
      timeGroups[timeKey].push(transaction);
    });

    // Convert to time series format
    return Object.entries(timeGroups)
      .map(([timeKey, txns]) => ({
        date: timeKey,
        income: txns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
        expenses: Math.abs(txns.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
        net: txns.reduce((sum, t) => sum + t.amount, 0),
        count: txns.length
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generate metadata about the processed data
   */
  private generateMetadata(
    filteredTransactions: Transaction[], 
    allTransactions: Transaction[], 
    timeRange?: TimeRange
  ): DataMetadata {
    const categories = [...new Set(filteredTransactions.map(t => t.category || 'Uncategorized'))];
    const payees = [...new Set(filteredTransactions.map(t => t.payee))];
    const currencies = [...new Set(filteredTransactions.map(t => t.currency || 'USD'))];

    return {
      totalRecords: allTransactions.length,
      filteredRecords: filteredTransactions.length,
      dateRange: timeRange || {
        start: new Date(Math.min(...filteredTransactions.map(t => t.date.getTime()))),
        end: new Date(Math.max(...filteredTransactions.map(t => t.date.getTime())))
      },
      categories: categories.sort(),
      payees: payees.sort(),
      currencies: currencies.sort()
    };
  }

  /**
   * Generate summary statistics
   */
  generateSummaryStatistics(transactions: Transaction[]): SummaryStatistics {
    const income = transactions.filter(t => t.amount > 0);
    const expenses = transactions.filter(t => t.amount < 0);
    
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
    const netAmount = totalIncome - totalExpenses;
    const averageTransaction = transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length 
      : 0;

    // Top categories by spending
    const categorySpending: Record<string, number> = {};
    expenses.forEach(t => {
      const category = t.category || 'Uncategorized';
      categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount);
    });

    const topCategories = Object.entries(categorySpending)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Top payees by spending
    const payeeSpending: Record<string, { amount: number; count: number }> = {};
    expenses.forEach(t => {
      const payee = t.payee;
      if (!payeeSpending[payee]) {
        payeeSpending[payee] = { amount: 0, count: 0 };
      }
      payeeSpending[payee].amount += Math.abs(t.amount);
      payeeSpending[payee].count += 1;
    });

    const topPayees = Object.entries(payeeSpending)
      .map(([payee, data]) => ({
        payee,
        amount: data.amount,
        count: data.count
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalIncome,
      totalExpenses,
      netAmount,
      averageTransaction,
      transactionCount: transactions.length,
      topCategories,
      topPayees
    };
  }

  /**
   * Automatically adjust time granularity based on date range
   */
  getOptimalTimeGranularity(timeRange: TimeRange): GroupingType {
    const daysDiff = Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 7) {
      return GroupingType.DATE_DAY;
    } else if (daysDiff <= 31) {
      return GroupingType.DATE_DAY;
    } else if (daysDiff <= 90) {
      return GroupingType.DATE_WEEK;
    } else {
      return GroupingType.DATE_MONTH;
    }
  }
}

// Export singleton instance
export const dataProcessor = new DataProcessor();
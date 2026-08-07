// Visualization Engine for Interactive Analytics using Apache ECharts
import * as echarts from 'echarts';
import { 
  ProcessedData, 
  WidgetConfiguration, 
  WidgetType, 
  ChartInstance, 
  ExportFormat,
  ValidationResult,
  ValidationError
} from '../types/interactive-analytics';

export class VisualizationEngine {
  private chartInstances: Map<string, echarts.ECharts> = new Map();

  /**
   * Render a chart based on processed data and configuration
   */
  renderChart(
    container: HTMLElement, 
    data: ProcessedData, 
    config: WidgetConfiguration, 
    type: WidgetType
  ): ChartInstance {
    const chartId = `chart_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Dispose existing chart if container is reused
    if (this.chartInstances.has(container.id)) {
      this.chartInstances.get(container.id)?.dispose();
    }

    // Initialize ECharts instance
    const chart = echarts.init(container);
    this.chartInstances.set(chartId, chart);

    // Generate chart options based on type and data
    const options = this.generateChartOptions(type, data, config);
    
    // Set chart options
    chart.setOption(options);

    // Make chart responsive
    window.addEventListener('resize', () => {
      chart.resize();
    });

    return {
      id: chartId,
      type,
      echartInstance: chart,
      configuration: config,
      data
    };
  }

  /**
   * Update an existing chart with new data
   */
  updateChart(chart: ChartInstance, data: ProcessedData): void {
    if (!chart.echartInstance) return;

    const options = this.generateChartOptions(chart.type, data, chart.configuration);
    chart.echartInstance.setOption(options, true); // true = notMerge
    chart.data = data;
  }

  /**
   * Export chart as image or data
   */
  async exportChart(chart: ChartInstance, format: ExportFormat): Promise<Blob> {
    if (!chart.echartInstance) {
      throw new Error('Chart instance not found');
    }

    switch (format) {
      case ExportFormat.PNG:
        const pngDataUrl = chart.echartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff'
        });
        return this.dataUrlToBlob(pngDataUrl);

      case ExportFormat.SVG:
        const svgDataUrl = chart.echartInstance.getDataURL({
          type: 'svg',
          backgroundColor: '#fff'
        });
        return this.dataUrlToBlob(svgDataUrl);

      case ExportFormat.CSV:
        return this.exportDataAsCSV(chart.data);

      case ExportFormat.JSON:
        return new Blob([JSON.stringify(chart.data, null, 2)], { type: 'application/json' });

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get available chart types for given data
   */
  getAvailableChartTypes(data: ProcessedData): WidgetType[] {
    const availableTypes: WidgetType[] = [WidgetType.TABLE, WidgetType.METRIC_CARD];

    // Check if data is suitable for different chart types
    const aggregatedEntries = Object.entries(data.aggregated);
    
    if (aggregatedEntries.length > 0) {
      availableTypes.push(WidgetType.BAR_CHART);
      
      if (aggregatedEntries.length <= 10) {
        availableTypes.push(WidgetType.PIE_CHART);
      }
      
      // Check if data has time dimension for line chart
      const hasTimeDimension = aggregatedEntries.some(([key]) => 
        key.includes('-') && /\d{4}-\d{2}/.test(key)
      );
      
      if (hasTimeDimension) {
        availableTypes.push(WidgetType.LINE_CHART);
      }

      // Heatmap requires at least 2 dimensions
      if (aggregatedEntries.some(([key]) => key.includes(' | '))) {
        availableTypes.push(WidgetType.HEATMAP);
      }
    }

    return availableTypes;
  }

  /**
   * Validate chart configuration
   */
  validateChartConfig(config: WidgetConfiguration, type: WidgetType): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: any[] = [];

    // Type-specific validation
    switch (type) {
      case WidgetType.PIE_CHART:
        if (config.chartOptions?.series?.[0]?.data?.length > 15) {
          warnings.push({
            field: 'data',
            message: 'Pie charts with more than 15 segments may be hard to read',
            code: 'TOO_MANY_SEGMENTS'
          });
        }
        break;

      case WidgetType.LINE_CHART:
        if (!config.chartOptions?.xAxis?.type) {
          errors.push({
            field: 'xAxis',
            message: 'Line charts require an X-axis configuration',
            code: 'MISSING_X_AXIS'
          });
        }
        break;

      case WidgetType.HEATMAP:
        if (!config.chartOptions?.visualMap) {
          warnings.push({
            field: 'visualMap',
            message: 'Heatmaps work better with a visual map configuration',
            code: 'MISSING_VISUAL_MAP'
          });
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Dispose of a chart instance
   */
  disposeChart(chartId: string): void {
    const chart = this.chartInstances.get(chartId);
    if (chart) {
      chart.dispose();
      this.chartInstances.delete(chartId);
    }
  }

  /**
   * Dispose of all chart instances
   */
  disposeAllCharts(): void {
    this.chartInstances.forEach(chart => chart.dispose());
    this.chartInstances.clear();
  }

  // Private helper methods

  private generateChartOptions(type: WidgetType, data: ProcessedData, config: WidgetConfiguration): any {
    const baseOptions = {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      tooltip: {
        show: config.showTooltip !== false,
        trigger: 'item',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'transparent',
        textStyle: {
          color: '#fff'
        }
      },
      legend: {
        show: config.showLegend !== false,
        type: 'scroll',
        orient: 'horizontal',
        bottom: 0
      }
    };

    switch (type) {
      case WidgetType.BAR_CHART:
        return this.generateBarChartOptions(data, config, baseOptions);
      
      case WidgetType.LINE_CHART:
        return this.generateLineChartOptions(data, config, baseOptions);
      
      case WidgetType.PIE_CHART:
        return this.generatePieChartOptions(data, config, baseOptions);
      
      case WidgetType.HEATMAP:
        return this.generateHeatmapOptions(data, config, baseOptions);
      
      default:
        return baseOptions;
    }
  }

  private generateBarChartOptions(data: ProcessedData, config: WidgetConfiguration, baseOptions: any): any {
    const aggregatedEntries = Object.entries(data.aggregated);
    const categories = aggregatedEntries.map(([key]) => key);
    const values = aggregatedEntries.map(([, value]) => Math.abs(value.value));

    return {
      ...baseOptions,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          rotate: categories.length > 5 ? 45 : 0,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      series: [{
        name: 'Amount',
        type: 'bar',
        data: values,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#1d4ed8' }
          ])
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#60a5fa' },
              { offset: 1, color: '#3b82f6' }
            ])
          }
        }
      }],
      ...config.chartOptions
    };
  }

  private generateLineChartOptions(data: ProcessedData, config: WidgetConfiguration, baseOptions: any): any {
    // Assume time series data format
    const timeSeriesData = this.extractTimeSeriesData(data);
    
    return {
      ...baseOptions,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timeSeriesData.map(d => d.date),
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => this.formatCurrency(value)
        }
      },
      series: [
        {
          name: 'Income',
          type: 'line',
          data: timeSeriesData.map(d => d.income || 0),
          smooth: true,
          itemStyle: { color: '#10b981' },
          areaStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.1)' }
            ])
          }
        },
        {
          name: 'Expenses',
          type: 'line',
          data: timeSeriesData.map(d => d.expenses || 0),
          smooth: true,
          itemStyle: { color: '#ef4444' },
          areaStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.1)' }
            ])
          }
        }
      ],
      ...config.chartOptions
    };
  }

  private generatePieChartOptions(data: ProcessedData, config: WidgetConfiguration, baseOptions: any): any {
    const aggregatedEntries = Object.entries(data.aggregated);
    const pieData = aggregatedEntries.map(([key, value]) => ({
      name: key,
      value: Math.abs(value.value)
    }));

    return {
      ...baseOptions,
      series: [{
        name: 'Distribution',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        data: pieData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          formatter: '{b}: {d}%'
        }
      }],
      ...config.chartOptions
    };
  }

  private generateHeatmapOptions(data: ProcessedData, config: WidgetConfiguration, baseOptions: any): any {
    // Extract heatmap data from aggregated data
    const heatmapData = this.extractHeatmapData(data);
    
    return {
      ...baseOptions,
      grid: {
        height: '50%',
        top: '10%'
      },
      xAxis: {
        type: 'category',
        data: heatmapData.xCategories,
        splitArea: {
          show: true
        }
      },
      yAxis: {
        type: 'category',
        data: heatmapData.yCategories,
        splitArea: {
          show: true
        }
      },
      visualMap: {
        min: heatmapData.minValue,
        max: heatmapData.maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '15%',
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffcc', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        }
      },
      series: [{
        name: 'Heatmap',
        type: 'heatmap',
        data: heatmapData.data,
        label: {
          show: true,
          formatter: (params: any) => this.formatCurrency(params.value[2])
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }],
      ...config.chartOptions
    };
  }

  private extractTimeSeriesData(data: ProcessedData): any[] {
    // Try to extract time series from aggregated data
    const aggregatedEntries = Object.entries(data.aggregated);
    
    // Look for date patterns in keys
    const timeEntries = aggregatedEntries.filter(([key]) => 
      /\d{4}-\d{2}/.test(key) || key.includes('Week of')
    );

    if (timeEntries.length > 0) {
      return timeEntries.map(([key, value]) => ({
        date: key,
        income: value.value > 0 ? value.value : 0,
        expenses: value.value < 0 ? Math.abs(value.value) : 0,
        net: value.value
      }));
    }

    // Fallback: use raw data if available
    return data.raw.slice(0, 50).map((item: any, index: number) => ({
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : `Day ${index + 1}`,
      income: item.amount > 0 ? item.amount : 0,
      expenses: item.amount < 0 ? Math.abs(item.amount) : 0,
      net: item.amount
    }));
  }

  private extractHeatmapData(data: ProcessedData): any {
    const aggregatedEntries = Object.entries(data.aggregated);
    
    // Look for entries with multiple dimensions (containing ' | ')
    const multiDimEntries = aggregatedEntries.filter(([entryKey]) => entryKey.includes(' | '));
    
    if (multiDimEntries.length === 0) {
      // Fallback: create a simple heatmap
      return {
        xCategories: ['Category'],
        yCategories: aggregatedEntries.map(([entryKey]) => entryKey),
        data: aggregatedEntries.map(([, value], index) => [0, index, Math.abs(value.value)]),
        minValue: 0,
        maxValue: Math.max(...aggregatedEntries.map(([, value]) => Math.abs(value.value)))
      };
    }

    // Extract dimensions
    const xCategories = [...new Set(multiDimEntries.map(([entryKey]) => entryKey.split(' | ')[0]))];
    const yCategories = [...new Set(multiDimEntries.map(([entryKey]) => entryKey.split(' | ')[1]))];
    
    const values = multiDimEntries.map(([, value]) => Math.abs(value.value));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const heatmapData = multiDimEntries.map(([entryKey, value]) => {
      const [xDim, yDim] = entryKey.split(' | ');
      const xIndex = xCategories.indexOf(xDim);
      const yIndex = yCategories.indexOf(yDim);
      return [xIndex, yIndex, Math.abs(value.value)];
    });

    return {
      xCategories,
      yCategories,
      data: heatmapData,
      minValue,
      maxValue
    };
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  }

  private exportDataAsCSV(data: ProcessedData): Blob {
    const headers = ['Category', 'Value', 'Count', 'Percentage'];
    const rows = Object.entries(data.aggregated).map(([key, value]) => [
      key,
      value.value.toString(),
      value.count.toString(),
      (value.percentage || 0).toFixed(2) + '%'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return new Blob([csvContent], { type: 'text/csv' });
  }
}

// Export singleton instance
export const visualizationEngine = new VisualizationEngine();
import { useEffect, useRef, useState } from 'react';
import { 
  Widget as WidgetType, 
  ProcessedData, 
  ChartInstance, 
  WidgetType as WidgetTypeEnum 
} from '../types/interactive-analytics';
import { visualizationEngine } from '../utils/visualizationEngine';
import { 
  MoreVertical, 
  Download, 
  Edit3, 
  Trash2,
  BarChart3,
  LineChart,
  PieChart,
  Table,
  Activity
} from 'lucide-react';

interface WidgetProps {
  widget: WidgetType;
  data?: ProcessedData;
  onUpdate?: (widget: WidgetType) => void;
  onDelete?: (widgetId: string) => void;
  onExport?: (widget: WidgetType) => void;
}

export function Widget({ widget, data, onDelete, onExport }: WidgetProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartInstance, setChartInstance] = useState<ChartInstance | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize chart when component mounts or data changes
  useEffect(() => {
    if (!chartContainerRef.current || !data) return;

    setIsLoading(true);
    setError(null);

    try {
      // Dispose existing chart
      if (chartInstance) {
        visualizationEngine.disposeChart(chartInstance.id);
      }

      // Create new chart instance
      const newChartInstance = visualizationEngine.renderChart(
        chartContainerRef.current,
        data,
        widget.configuration,
        widget.type
      );

      setChartInstance(newChartInstance);
    } catch (err) {
      console.error('Error rendering chart:', err);
      setError(err instanceof Error ? err.message : 'Failed to render chart');
    } finally {
      setIsLoading(false);
    }
  }, [data, widget.configuration, widget.type]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance) {
        visualizationEngine.disposeChart(chartInstance.id);
      }
    };
  }, [chartInstance]);

  const handleExport = async () => {
    if (onExport) {
      onExport(widget);
    }
    setShowMenu(false);
  };

  const handleEdit = () => {
    // TODO: Open widget configuration dialog
    console.log('Edit widget:', widget.id);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (onDelete && window.confirm('Are you sure you want to delete this widget?')) {
      onDelete(widget.id);
    }
    setShowMenu(false);
  };

  const getWidgetIcon = () => {
    const iconProps = { size: 16, className: 'text-gray-500' };
    switch (widget.type) {
      case WidgetTypeEnum.BAR_CHART:
        return <BarChart3 {...iconProps} />;
      case WidgetTypeEnum.LINE_CHART:
        return <LineChart {...iconProps} />;
      case WidgetTypeEnum.PIE_CHART:
        return <PieChart {...iconProps} />;
      case WidgetTypeEnum.TABLE:
        return <Table {...iconProps} />;
      case WidgetTypeEnum.METRIC_CARD:
      case WidgetTypeEnum.HEATMAP:
        return <Activity {...iconProps} />;
      default:
        return <BarChart3 {...iconProps} />;
    }
  };

  const renderTableView = () => {
    if (!data || !data.aggregated) return null;

    const entries = Object.entries(data.aggregated);
    
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Category</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Amount</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">Count</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">%</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, value], index) => (
              <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-gray-900">{key}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(Math.abs(value.value))}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">{value.count}</td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {(value.percentage || 0).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMetricCard = () => {
    if (!data || !data.statistics) return null;

    const { statistics } = data;
    
    return (
      <div className="h-full flex flex-col justify-center items-center text-center p-4">
        <div className="text-3xl font-bold text-gray-900 mb-2">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          }).format(Math.abs(statistics.netAmount))}
        </div>
        <div className="text-sm text-gray-600 mb-4">Net Amount</div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-medium text-green-600">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
              }).format(statistics.totalIncome)}
            </div>
            <div className="text-gray-500">Income</div>
          </div>
          <div>
            <div className="font-medium text-red-600">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
              }).format(statistics.totalExpenses)}
            </div>
            <div className="text-gray-500">Expenses</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow border h-full flex flex-col">
      {/* Widget Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          {getWidgetIcon()}
          <h3 className="font-medium text-gray-900 truncate">{widget.title}</h3>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <MoreVertical size={16} />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <button
                onClick={handleEdit}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Edit3 size={14} />
                Edit
              </button>
              <button
                onClick={handleExport}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Download size={14} />
                Export
              </button>
              <button
                onClick={handleDelete}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="flex-1 p-4 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="text-red-600 mb-2">Error</div>
              <div className="text-sm text-gray-600">{error}</div>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {widget.type === WidgetTypeEnum.TABLE && renderTableView()}
            {widget.type === WidgetTypeEnum.METRIC_CARD && renderMetricCard()}
            {widget.type !== WidgetTypeEnum.TABLE && widget.type !== WidgetTypeEnum.METRIC_CARD && (
              <div 
                ref={chartContainerRef} 
                className="w-full h-full min-h-[200px]"
                style={{ minHeight: '200px' }}
              />
            )}
          </>
        )}

        {!data && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="mb-2">No data available</div>
              <div className="text-sm">Configure filters and groupings to see data</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
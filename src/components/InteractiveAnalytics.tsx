import { useState, useCallback, useMemo, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { Transaction } from '../types';
import { 
  Dashboard, 
  Widget as WidgetType, 
  AnalyticsQuery, 
  Filter, 
  DataDimension, 
  DropZone, 
  DropZoneType,
  DimensionType,
  FilterType,
  WidgetType as WidgetTypeEnum,
  TimeRangePreset,
  QuickFilter,
  ProcessedData
} from '../types/interactive-analytics';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Widget } from './Widget';
import { DashboardManager } from './DashboardManager';
import { dataProcessor } from '../utils/dataProcessor';
import { dashboardStorage } from '../utils/dashboardStorage';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  Table, 
  Activity, 
  Zap,
  Plus,
  Save,
  FolderOpen,
  Share2,
  Filter as FilterIcon,
  Calendar,
  DollarSign,
  Tag,
  User,
  Layers
} from 'lucide-react';

interface InteractiveAnalyticsProps {
  transactions: Transaction[];
}

export function InteractiveAnalytics({ transactions }: InteractiveAnalyticsProps) {
  const showToast = useToast();
  // State Management
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [showQueryBuilder] = useState(true);
  const [showDashboardManager, setShowDashboardManager] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Filter[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [currentQuery, setCurrentQuery] = useState<AnalyticsQuery>({
    filters: [],
    groupings: [],
    aggregations: [],
    timeRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
      preset: TimeRangePreset.LAST_30_DAYS
    }
  });

  // Load dashboard on component mount
  useEffect(() => {
    const loadDefaultDashboard = async () => {
      const dashboards = await dashboardStorage.listDashboards();
      if (dashboards.length > 0) {
        // Load the most recently updated dashboard
        const latest = dashboards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
        const dashboard = await dashboardStorage.loadDashboard(latest.id);
        if (dashboard) {
          setCurrentDashboard(dashboard);
        }
      }
    };
    
    loadDefaultDashboard();
  }, []);

  // Process data when query or transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      const combinedFilters = [...currentQuery.filters, ...activeFilters];
      const queryWithFilters = { ...currentQuery, filters: combinedFilters };
      const processed = dataProcessor.processTransactions(transactions, queryWithFilters);
      setProcessedData(processed);
    }
  }, [transactions, currentQuery, activeFilters]);

  // Available Data Dimensions
  const dataDimensions = useMemo<DataDimension[]>(() => [
    {
      id: 'category',
      name: 'Category',
      field: 'category',
      type: DimensionType.CATEGORICAL,
      icon: 'Layers',
      description: 'Transaction categories'
    },
    {
      id: 'payee',
      name: 'Payee',
      field: 'payee',
      type: DimensionType.CATEGORICAL,
      icon: 'User',
      description: 'Transaction payees/merchants'
    },
    {
      id: 'amount',
      name: 'Amount',
      field: 'amount',
      type: DimensionType.NUMERICAL,
      icon: 'DollarSign',
      description: 'Transaction amounts'
    },
    {
      id: 'date',
      name: 'Date',
      field: 'date',
      type: DimensionType.TEMPORAL,
      icon: 'Calendar',
      description: 'Transaction dates'
    },
    {
      id: 'tags',
      name: 'Tags',
      field: 'tags',
      type: DimensionType.CATEGORICAL,
      icon: 'Tag',
      description: 'Transaction tags'
    }
  ], []);

  // Drop Zones Configuration
  const [dropZones, setDropZones] = useState<DropZone[]>([
    {
      id: 'group_by',
      type: DropZoneType.GROUP_BY,
      title: 'Group By',
      acceptedTypes: [DimensionType.CATEGORICAL, DimensionType.TEMPORAL],
      maxItems: 3,
      items: []
    },
    {
      id: 'filter_by',
      type: DropZoneType.FILTER_BY,
      title: 'Filter By',
      acceptedTypes: [DimensionType.CATEGORICAL, DimensionType.NUMERICAL, DimensionType.TEMPORAL],
      items: []
    },
    {
      id: 'aggregate_by',
      type: DropZoneType.AGGREGATE_BY,
      title: 'Aggregate By',
      acceptedTypes: [DimensionType.NUMERICAL],
      maxItems: 1,
      items: []
    }
  ]);

  // Quick Filters
  const quickFilters = useMemo<QuickFilter[]>(() => [
    {
      id: 'expenses_only',
      name: 'Expenses Only',
      description: 'Show only expense transactions',
      icon: 'TrendingDown',
      filter: {
        id: 'expenses_filter',
        type: FilterType.AMOUNT,
        field: 'amount',
        operator: 'less_than' as any,
        value: 0,
        enabled: true
      }
    },
    {
      id: 'income_only',
      name: 'Income Only',
      description: 'Show only income transactions',
      icon: 'TrendingUp',
      filter: {
        id: 'income_filter',
        type: FilterType.AMOUNT,
        field: 'amount',
        operator: 'greater_than' as any,
        value: 0,
        enabled: true
      }
    },
    {
      id: 'recent_activity',
      name: 'Recent Activity',
      description: 'Last 7 days',
      icon: 'Clock',
      filter: {
        id: 'recent_filter',
        type: FilterType.DATE,
        field: 'date',
        operator: 'greater_than' as any,
        value: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        enabled: true
      }
    }
  ], []);

  // Event Handlers
  const handleDragEnd = useCallback((result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    // Handle dimension dragging between zones
    if (source.droppableId === 'dimensions' && destination.droppableId !== 'dimensions') {
      const dimension = dataDimensions.find(d => d.id === draggableId);
      if (!dimension) return;

      const targetZone = dropZones.find(z => z.id === destination.droppableId);
      if (!targetZone || !targetZone.acceptedTypes.includes(dimension.type)) return;

      // Add dimension to target zone
      setDropZones(prev => prev.map(zone => {
        if (zone.id === destination.droppableId) {
          const newItems = [...zone.items];
          if (zone.maxItems && newItems.length >= zone.maxItems) {
            newItems.pop(); // Remove last item if at max capacity
          }
          newItems.splice(destination.index, 0, dimension);
          return { ...zone, items: newItems };
        }
        return zone;
      }));

      // Update query based on the zone
      updateQueryFromZones(destination.droppableId, dimension, 'add');
    }

    // Handle reordering within zones
    if (source.droppableId === destination.droppableId && source.droppableId !== 'dimensions') {
      setDropZones(prev => prev.map(zone => {
        if (zone.id === source.droppableId) {
          const newItems = [...zone.items];
          const [removed] = newItems.splice(source.index, 1);
          newItems.splice(destination.index, 0, removed);
          return { ...zone, items: newItems };
        }
        return zone;
      }));
    }
  }, [dataDimensions, dropZones]);

  const updateQueryFromZones = useCallback((zoneId: string, dimension: DataDimension, action: 'add' | 'remove') => {
    setCurrentQuery(prev => {
      const newQuery = { ...prev };

      switch (zoneId) {
        case 'group_by':
          if (action === 'add') {
            newQuery.groupings = [...prev.groupings, {
              field: dimension.field,
              type: dimension.type === DimensionType.TEMPORAL ? 'date_month' as any : 'exact' as any,
              order: 'desc' as any
            }];
          }
          break;
        case 'filter_by':
          if (action === 'add') {
            // Create appropriate filter based on dimension type
            const filter: Filter = {
              id: `filter_${dimension.id}_${Date.now()}`,
              type: dimension.field as FilterType,
              field: dimension.field,
              operator: 'equals' as any,
              value: null,
              enabled: true
            };
            newQuery.filters = [...prev.filters, filter];
          }
          break;
        case 'aggregate_by':
          if (action === 'add') {
            newQuery.aggregations = [{
              field: dimension.field,
              function: 'sum' as any,
              alias: `${dimension.name} Total`
            }];
          }
          break;
      }

      return newQuery;
    });
  }, []);

  const applyQuickFilter = useCallback((quickFilter: QuickFilter) => {
    setActiveFilters(prev => {
      const existing = prev.find(f => f.id === quickFilter.filter.id);
      if (existing) {
        // Remove if already applied
        return prev.filter(f => f.id !== quickFilter.filter.id);
      } else {
        // Add new quick filter
        return [...prev, quickFilter.filter];
      }
    });
  }, []);

  const createNewWidget = useCallback((type: WidgetTypeEnum) => {
    if (!currentDashboard) {
      // Create a new dashboard if none exists
      const newDashboard = dashboardStorage.createDefaultDashboard('My Dashboard');
      setCurrentDashboard(newDashboard);
    }

    const newWidget: WidgetType = {
      id: `widget_${Date.now()}`,
      type,
      title: `New ${type.replace('_', ' ')} Chart`,
      position: { x: 0, y: 0 },
      size: { width: 6, height: 4 },
      configuration: {
        showLegend: true,
        showTooltip: true
      },
      query: currentQuery
    };

    setCurrentDashboard(prev => prev ? {
      ...prev,
      widgets: [...prev.widgets, newWidget],
      updatedAt: new Date()
    } : null);
  }, [currentDashboard, currentQuery]);

  const saveDashboard = useCallback(async () => {
    if (currentDashboard) {
      try {
        await dashboardStorage.saveDashboard(currentDashboard);
        showToast('Dashboard saved.', 'success');
      } catch (error) {
        console.error('Failed to save dashboard:', error);
        showToast('Failed to save dashboard.', 'error');
      }
    }
  }, [currentDashboard]);

  // Render Helper Functions
  const renderDimensionPalette = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Layers size={20} />
        Available Dimensions
      </h3>
      <Droppable droppableId="dimensions" direction="horizontal">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-wrap gap-2"
          >
            {dataDimensions.map((dimension, index) => (
              <Draggable key={dimension.id} draggableId={dimension.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`px-3 py-2 bg-blue-100 text-blue-800 rounded-md cursor-move transition-all ${
                      snapshot.isDragging ? 'shadow-lg scale-105' : 'hover:bg-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getDimensionIcon(dimension.icon)}
                      <span className="text-sm font-medium">{dimension.name}</span>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );

  const renderDropZones = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      {dropZones.map(zone => (
        <div key={zone.id} className="bg-white rounded-lg shadow p-4">
          <h4 className="font-medium mb-3 text-gray-700">{zone.title}</h4>
          <Droppable droppableId={zone.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[100px] border-2 border-dashed rounded-lg p-3 transition-colors ${
                  snapshot.isDraggingOver 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                {zone.items.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8">
                    Drop {zone.acceptedTypes.join(' or ')} dimensions here
                  </div>
                ) : (
                  zone.items.map((item, index) => (
                    <Draggable key={`${zone.id}_${item.id}`} draggableId={`${zone.id}_${item.id}`} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="px-3 py-2 bg-green-100 text-green-800 rounded-md mb-2 cursor-move"
                        >
                          <div className="flex items-center gap-2">
                            {getDimensionIcon(item.icon)}
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      ))}
    </div>
  );

  const renderQuickFilters = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Zap size={20} />
        Quick Filters
      </h3>
      <div className="flex flex-wrap gap-2">
        {quickFilters.map(filter => {
          const isActive = activeFilters.some(f => f.id === filter.filter.id);
          return (
            <button
              key={filter.id}
              onClick={() => applyQuickFilter(filter)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.name}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderVisualizationOptions = () => (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <BarChart3 size={20} />
        Add Visualization
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.values(WidgetTypeEnum).map(type => (
          <button
            key={type}
            onClick={() => createNewWidget(type)}
            className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex flex-col items-center gap-2">
              {getWidgetIcon(type)}
              <span className="text-xs font-medium capitalize">
                {type.replace('_', ' ')}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const getDimensionIcon = (iconName?: string) => {
    const iconProps = { size: 16 };
    switch (iconName) {
      case 'Layers': return <Layers {...iconProps} />;
      case 'User': return <User {...iconProps} />;
      case 'DollarSign': return <DollarSign {...iconProps} />;
      case 'Calendar': return <Calendar {...iconProps} />;
      case 'Tag': return <Tag {...iconProps} />;
      default: return <FilterIcon {...iconProps} />;
    }
  };

  const getWidgetIcon = (type: WidgetTypeEnum) => {
    const iconProps = { size: 20 };
    switch (type) {
      case WidgetTypeEnum.BAR_CHART: return <BarChart3 {...iconProps} />;
      case WidgetTypeEnum.LINE_CHART: return <LineChart {...iconProps} />;
      case WidgetTypeEnum.PIE_CHART: return <PieChart {...iconProps} />;
      case WidgetTypeEnum.TABLE: return <Table {...iconProps} />;
      case WidgetTypeEnum.METRIC_CARD: return <Activity {...iconProps} />;
      case WidgetTypeEnum.HEATMAP: return <Activity {...iconProps} />;
      default: return <BarChart3 {...iconProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Interactive Analytics</h1>
                <p className="text-sm text-gray-600">
                  {currentDashboard ? currentDashboard.name : 'Create your first dashboard'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowDashboardManager(true)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
                >
                  <FolderOpen size={16} />
                  Dashboards
                </button>
                <button 
                  onClick={saveDashboard}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save size={16} />
                  Save
                </button>
                <button className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2">
                  <Share2 size={16} />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {showQueryBuilder && (
            <div className="mb-6">
              {renderDimensionPalette()}
              {renderDropZones()}
              {renderQuickFilters()}
              {renderVisualizationOptions()}
            </div>
          )}

          {/* Dashboard Canvas */}
          <div className="bg-white rounded-lg shadow p-6">
            {currentDashboard && currentDashboard.widgets.length > 0 ? (
              <div className="grid grid-cols-12 gap-4">
                {currentDashboard.widgets.map(widget => {
                  const colSpanClass = `col-span-${Math.min(widget.size.width, 12)}`;
                  return (
                    <div
                      key={widget.id}
                      className={colSpanClass}
                      style={{ minHeight: `${widget.size.height * 40}px` }}
                    >
                      <Widget
                        widget={widget}
                        data={processedData || undefined}
                        onUpdate={(updatedWidget) => {
                          setCurrentDashboard(prev => prev ? {
                            ...prev,
                            widgets: prev.widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w),
                            updatedAt: new Date()
                          } : null);
                        }}
                        onDelete={(widgetId) => {
                          setCurrentDashboard(prev => prev ? {
                            ...prev,
                            widgets: prev.widgets.filter(w => w.id !== widgetId),
                            updatedAt: new Date()
                          } : null);
                        }}
                        onExport={(widget) => {
                          console.log('Export widget:', widget.id);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No visualizations yet</h3>
                <p className="text-gray-600 mb-4">
                  Start by dragging dimensions to the drop zones above, then add visualizations
                </p>
                <button
                  onClick={() => createNewWidget(WidgetTypeEnum.BAR_CHART)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
                >
                  <Plus size={16} />
                  Add Your First Chart
                </button>
              </div>
            )}
          </div>
        </div>
      </DragDropContext>

      {/* Dashboard Manager Modal */}
      {showDashboardManager && (
        <DashboardManager
          currentDashboard={currentDashboard}
          onSelectDashboard={(dashboard) => {
            setCurrentDashboard(dashboard);
            setShowDashboardManager(false);
          }}
          onClose={() => setShowDashboardManager(false)}
        />
      )}
    </div>
  );
}
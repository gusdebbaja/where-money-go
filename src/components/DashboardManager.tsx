import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { Dashboard, DashboardSummary } from '../types/interactive-analytics';
import { dashboardStorage } from '../utils/dashboardStorage';
import { 
  Plus, 
  FolderOpen, 
  Trash2, 
  Copy, 
  Download, 
  Upload,
  X,
  Calendar,
  BarChart3
} from 'lucide-react';

interface DashboardManagerProps {
  currentDashboard: Dashboard | null;
  onSelectDashboard: (dashboard: Dashboard) => void;
  onClose: () => void;
}

export function DashboardManager({ currentDashboard, onSelectDashboard, onClose }: DashboardManagerProps) {
  const showToast = useToast();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    try {
      const dashboardList = await dashboardStorage.listDashboards();
      setDashboards(dashboardList);
    } catch (error) {
      console.error('Failed to load dashboards:', error);
      showToast('Failed to load dashboards.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;

    try {
      const newDashboard = dashboardStorage.createDefaultDashboard(newDashboardName.trim());
      await dashboardStorage.saveDashboard(newDashboard);
      onSelectDashboard(newDashboard);
      setShowCreateForm(false);
      setNewDashboardName('');
      await loadDashboards();
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      showToast('Failed to create dashboard.', 'error');
    }
  };

  const handleSelectDashboard = async (summary: DashboardSummary) => {
    try {
      const dashboard = await dashboardStorage.loadDashboard(summary.id);
      if (dashboard) {
        onSelectDashboard(dashboard);
        onClose();
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      showToast('Failed to load dashboard.', 'error');
    }
  };

  const handleDuplicateDashboard = async (summary: DashboardSummary) => {
    try {
      const duplicated = await dashboardStorage.duplicateDashboard(summary.id);
      if (duplicated) {
        await loadDashboards();
      }
    } catch (error) {
      console.error('Failed to duplicate dashboard:', error);
      showToast('Failed to duplicate dashboard.', 'error');
    }
  };

  const handleDeleteDashboard = async (summary: DashboardSummary) => {
    if (!window.confirm(`Are you sure you want to delete "${summary.name}"?`)) return;

    try {
      await dashboardStorage.deleteDashboard(summary.id);
      await loadDashboards();

      // If the deleted dashboard was the current one, clear it
      if (currentDashboard?.id === summary.id) {
        onSelectDashboard(dashboardStorage.createDefaultDashboard());
      }
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      showToast('Failed to delete dashboard.', 'error');
    }
  };

  const handleExportDashboard = async (summary: DashboardSummary) => {
    try {
      const dashboard = await dashboardStorage.loadDashboard(summary.id);
      if (dashboard) {
        const dataStr = JSON.stringify(dashboard, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${summary.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_dashboard.json`;
        link.click();

        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export dashboard:', error);
      showToast('Failed to export dashboard.', 'error');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FolderOpen size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Dashboard Manager</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={16} />
              New Dashboard
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="p-6 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="Enter dashboard name..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateDashboard()}
                autoFocus
              />
              <button
                onClick={handleCreateDashboard}
                disabled={!newDashboardName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewDashboardName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Dashboard List */}
        <div className="p-6 overflow-y-auto max-h-96">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading dashboards...</div>
          ) : dashboards.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No dashboards yet</h3>
              <p className="text-gray-600 mb-4">Create your first dashboard to get started</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <Plus size={16} />
                Create Dashboard
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboards.map((dashboard) => (
                <div
                  key={dashboard.id}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    currentDashboard?.id === dashboard.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onClick={() => handleSelectDashboard(dashboard)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 truncate">{dashboard.name}</h3>
                      {dashboard.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{dashboard.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateDashboard(dashboard);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportDashboard(dashboard);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        title="Export"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDashboard(dashboard);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <BarChart3 size={14} />
                      <span>{dashboard.widgetCount} widgets</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{formatDate(dashboard.updatedAt)}</span>
                    </div>
                  </div>

                  {currentDashboard?.id === dashboard.id && (
                    <div className="mt-2 text-xs text-blue-600 font-medium">Current Dashboard</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''} total
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <Upload size={16} />
                Import
              </button>
              <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <Download size={16} />
                Export All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
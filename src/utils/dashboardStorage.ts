// Dashboard Storage Manager for Interactive Analytics
import { 
  Dashboard, 
  DashboardSummary, 
  StorageUsage, 
  ConfigurationBackup,
  StorageManagerInterface 
} from '../types/interactive-analytics';

export class DashboardStorageManager implements StorageManagerInterface {
  private readonly STORAGE_KEY = 'interactive-analytics-dashboards';
  private readonly METADATA_KEY = 'interactive-analytics-metadata';
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

  /**
   * Save a dashboard to localStorage
   */
  async saveDashboard(dashboard: Dashboard): Promise<void> {
    try {
      const dashboards = await this.getAllDashboards();
      const existingIndex = dashboards.findIndex(d => d.id === dashboard.id);
      
      if (existingIndex >= 0) {
        dashboards[existingIndex] = { ...dashboard, updatedAt: new Date() };
      } else {
        dashboards.push({ ...dashboard, createdAt: new Date(), updatedAt: new Date() });
      }

      // Check storage size before saving
      const serialized = JSON.stringify(dashboards);
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        throw new Error('Storage quota exceeded. Please delete some dashboards.');
      }

      localStorage.setItem(this.STORAGE_KEY, serialized);
      await this.updateMetadata();
    } catch (error) {
      console.error('Failed to save dashboard:', error);
      throw error;
    }
  }

  /**
   * Load a specific dashboard by ID
   */
  async loadDashboard(id: string): Promise<Dashboard | null> {
    try {
      const dashboards = await this.getAllDashboards();
      const dashboard = dashboards.find(d => d.id === id);
      
      if (dashboard) {
        // Convert date strings back to Date objects
        return {
          ...dashboard,
          createdAt: new Date(dashboard.createdAt),
          updatedAt: new Date(dashboard.updatedAt)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      return null;
    }
  }

  /**
   * Get list of all dashboard summaries
   */
  async listDashboards(): Promise<DashboardSummary[]> {
    try {
      const dashboards = await this.getAllDashboards();
      
      return dashboards.map(dashboard => ({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        createdAt: new Date(dashboard.createdAt),
        updatedAt: new Date(dashboard.updatedAt),
        widgetCount: dashboard.widgets.length,
        thumbnail: this.generateThumbnail(dashboard)
      }));
    } catch (error) {
      console.error('Failed to list dashboards:', error);
      return [];
    }
  }

  /**
   * Delete a dashboard by ID
   */
  async deleteDashboard(id: string): Promise<void> {
    try {
      const dashboards = await this.getAllDashboards();
      const filtered = dashboards.filter(d => d.id !== id);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      await this.updateMetadata();
    } catch (error) {
      console.error('Failed to delete dashboard:', error);
      throw error;
    }
  }

  /**
   * Get current storage usage statistics
   */
  getStorageUsage(): StorageUsage {
    try {
      const dashboardData = localStorage.getItem(this.STORAGE_KEY) || '[]';
      const used = new Blob([dashboardData]).size;
      const dashboards = JSON.parse(dashboardData);
      
      return {
        used,
        total: this.MAX_STORAGE_SIZE,
        percentage: (used / this.MAX_STORAGE_SIZE) * 100,
        dashboardCount: dashboards.length
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return {
        used: 0,
        total: this.MAX_STORAGE_SIZE,
        percentage: 0,
        dashboardCount: 0
      };
    }
  }

  /**
   * Clean up old or unused dashboards
   */
  async cleanupStorage(): Promise<void> {
    try {
      const dashboards = await this.getAllDashboards();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Remove dashboards older than 30 days with no widgets
      const cleaned = dashboards.filter(dashboard => {
        const updatedAt = new Date(dashboard.updatedAt);
        return dashboard.widgets.length > 0 || updatedAt > thirtyDaysAgo;
      });

      if (cleaned.length < dashboards.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cleaned));
        await this.updateMetadata();
        console.log(`Cleaned up ${dashboards.length - cleaned.length} old dashboards`);
      }
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
      throw error;
    }
  }

  /**
   * Export all configuration as backup
   */
  async exportConfiguration(): Promise<ConfigurationBackup> {
    try {
      const dashboards = await this.getAllDashboards();
      const metadata = this.getMetadata();
      
      return {
        version: '1.0.0',
        timestamp: new Date(),
        dashboards: dashboards.map(d => ({
          ...d,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt)
        })),
        templates: [], // TODO: Implement templates
        settings: metadata
      };
    } catch (error) {
      console.error('Failed to export configuration:', error);
      throw error;
    }
  }

  /**
   * Import configuration from backup
   */
  async importConfiguration(backup: ConfigurationBackup): Promise<void> {
    try {
      // Validate backup format
      if (!backup.version || !backup.dashboards) {
        throw new Error('Invalid backup format');
      }

      // Check storage capacity
      const serialized = JSON.stringify(backup.dashboards);
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        throw new Error('Backup too large for available storage');
      }

      // Import dashboards
      localStorage.setItem(this.STORAGE_KEY, serialized);
      
      // Import settings if available
      if (backup.settings) {
        localStorage.setItem(this.METADATA_KEY, JSON.stringify(backup.settings));
      }

      await this.updateMetadata();
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw error;
    }
  }

  /**
   * Create a new dashboard with default settings
   */
  createDefaultDashboard(name: string = 'New Dashboard'): Dashboard {
    return {
      id: `dashboard_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name,
      description: 'A new interactive analytics dashboard',
      widgets: [],
      layout: {
        columns: 12,
        rowHeight: 150,
        margin: [10, 10],
        containerPadding: [10, 10]
      },
      filters: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
  }

  /**
   * Duplicate an existing dashboard
   */
  async duplicateDashboard(sourceId: string, newName?: string): Promise<Dashboard | null> {
    try {
      const source = await this.loadDashboard(sourceId);
      if (!source) return null;

      const duplicate: Dashboard = {
        ...source,
        id: `dashboard_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name: newName || `${source.name} (Copy)`,
        widgets: source.widgets.map(widget => ({
          ...widget,
          id: `widget_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.saveDashboard(duplicate);
      return duplicate;
    } catch (error) {
      console.error('Failed to duplicate dashboard:', error);
      return null;
    }
  }

  // Private helper methods

  private async getAllDashboards(): Promise<Dashboard[]> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to parse dashboard data:', error);
      return [];
    }
  }

  private async updateMetadata(): Promise<void> {
    try {
      const dashboards = await this.getAllDashboards();
      const metadata = {
        lastUpdated: new Date().toISOString(),
        dashboardCount: dashboards.length,
        totalWidgets: dashboards.reduce((sum, d) => sum + d.widgets.length, 0),
        storageUsage: this.getStorageUsage()
      };
      
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  }

  private getMetadata(): any {
    try {
      const data = localStorage.getItem(this.METADATA_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return {};
    }
  }

  private generateThumbnail(dashboard: Dashboard): string {
    // Generate a simple text-based thumbnail representation
    const widgetTypes = dashboard.widgets.map(w => w.type).join(',');
    return `data:text/plain;base64,${btoa(widgetTypes)}`;
  }
}

// Export singleton instance
export const dashboardStorage = new DashboardStorageManager();
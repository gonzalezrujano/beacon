import type { DashboardLayout } from './store.svelte';
import type { WidgetConfig } from './widgetConfig';

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  layout: DashboardLayout;
  widgetConfigs: Record<string, Partial<WidgetConfig>>;
}

const KEY = 'beacon:templates';

export function loadTemplates(): DashboardTemplate[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch { return []; }
}

export function saveTemplates(list: DashboardTemplate[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function exportTemplate(t: DashboardTemplate): void {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `beacon-template-${t.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseTemplateFile(file: File): Promise<DashboardTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const t = JSON.parse(e.target?.result as string) as DashboardTemplate;
        if (!t.name || !t.layout) throw new Error('Invalid template file');
        resolve({ ...t, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

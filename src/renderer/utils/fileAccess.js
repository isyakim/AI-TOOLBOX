const STORAGE_KEY = 'ai-toolbox-file-access';
const MAX_LOGS = 20;

function getDefaultSettings() {
  return {
    enabled: false,
    autoExecute: false,
    showSteps: true,
    directories: ['src', 'config', 'README.md'],
    logs: []
  };
}

export function getFileAccessSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return getDefaultSettings();
    const parsed = JSON.parse(saved);
    return {
      ...getDefaultSettings(),
      ...parsed,
      directories: Array.isArray(parsed.directories) ? parsed.directories : getDefaultSettings().directories,
      logs: Array.isArray(parsed.logs) ? parsed.logs : []
    };
  } catch (error) {
    console.warn('解析文件权限配置失败:', error);
    return getDefaultSettings();
  }
}

export function saveFileAccessSettings(settings) {
  const merged = {
    ...getDefaultSettings(),
    ...settings,
    directories: (settings.directories || []).map(dir => dir.trim()).filter(Boolean),
    logs: settings.logs || []
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('fileAccessUpdated', { detail: merged }));
  }
  return merged;
}

export function addFileActionLog(entry) {
  const settings = getFileAccessSettings();
  const logs = [entry, ...settings.logs].slice(0, MAX_LOGS);
  saveFileAccessSettings({ ...settings, logs });
}

export function updateFileActionLogs(logs) {
  const settings = getFileAccessSettings();
  saveFileAccessSettings({ ...settings, logs });
}

export function clearFileActionLogs() {
  const settings = getFileAccessSettings();
  saveFileAccessSettings({ ...settings, logs: [] });
}

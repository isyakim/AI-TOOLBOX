// 主题管理器
export class ThemeManager {
  constructor() {
    this.storageKey = 'ai-toolbox-theme';
    this.currentTheme = this.loadTheme();
    this.themes = {
      light: {
        name: '浅色',
        colors: {
          '--primary': '#6366f1',
          '--primary-dark': '#4338ca',
          '--secondary': '#f8fafc',
          '--text': '#1e293b',
          '--text-light': '#64748b',
          '--border': '#e2e8f0',
          '--success': '#10b981',
          '--warning': '#f59e0b',
          '--error': '#ef4444',
          '--bg-main': 'rgba(255, 255, 255, 0.95)',
          '--bg-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }
      },
      dark: {
        name: '深色',
        colors: {
          '--primary': '#818cf8',
          '--primary-dark': '#6366f1',
          '--secondary': '#1e293b',
          '--text': '#f1f5f9',
          '--text-light': '#94a3b8',
          '--border': '#334155',
          '--success': '#34d399',
          '--warning': '#fbbf24',
          '--error': '#f87171',
          '--bg-main': 'rgba(15, 23, 42, 0.95)',
          '--bg-gradient': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
        }
      },
      blue: {
        name: '海洋蓝',
        colors: {
          '--primary': '#0ea5e9',
          '--primary-dark': '#0284c7',
          '--secondary': '#f0f9ff',
          '--text': '#0c4a6e',
          '--text-light': '#64748b',
          '--border': '#bae6fd',
          '--success': '#10b981',
          '--warning': '#f59e0b',
          '--error': '#ef4444',
          '--bg-main': 'rgba(255, 255, 255, 0.95)',
          '--bg-gradient': 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)'
        }
      },
      purple: {
        name: '紫罗兰',
        colors: {
          '--primary': '#a855f7',
          '--primary-dark': '#9333ea',
          '--secondary': '#faf5ff',
          '--text': '#581c87',
          '--text-light': '#64748b',
          '--border': '#e9d5ff',
          '--success': '#10b981',
          '--warning': '#f59e0b',
          '--error': '#ef4444',
          '--bg-main': 'rgba(255, 255, 255, 0.95)',
          '--bg-gradient': 'linear-gradient(135deg, #a855f7 0%, #c026d3 100%)'
        }
      },
      green: {
        name: '森林绿',
        colors: {
          '--primary': '#10b981',
          '--primary-dark': '#059669',
          '--secondary': '#f0fdf4',
          '--text': '#064e3b',
          '--text-light': '#64748b',
          '--border': '#bbf7d0',
          '--success': '#10b981',
          '--warning': '#f59e0b',
          '--error': '#ef4444',
          '--bg-main': 'rgba(255, 255, 255, 0.95)',
          '--bg-gradient': 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)'
        }
      }
    };
  }

  // 加载主题
  loadTheme() {
    const saved = localStorage.getItem(this.storageKey);
    return saved || 'light';
  }

  // 保存主题
  saveTheme(themeName) {
    localStorage.setItem(this.storageKey, themeName);
    this.currentTheme = themeName;
  }

  // 应用主题
  applyTheme(themeName) {
    const theme = this.themes[themeName];
    if (!theme) {
      console.error('主题不存在:', themeName);
      return;
    }

    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // 更新body背景
    document.body.style.background = theme.colors['--bg-gradient'];

    // 更新app容器背景
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.style.background = theme.colors['--bg-main'];
    }

    this.saveTheme(themeName);
    
    // 触发主题切换事件
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: themeName } 
    }));
  }

  // 获取当前主题
  getCurrentTheme() {
    return this.currentTheme;
  }

  // 获取所有主题
  getAllThemes() {
    return Object.entries(this.themes).map(([key, theme]) => ({
      id: key,
      name: theme.name
    }));
  }

  // 初始化主题
  init() {
    this.applyTheme(this.currentTheme);
  }

  // 切换主题（在主题间循环切换）
  toggleTheme() {
    const themeKeys = Object.keys(this.themes);
    const currentIndex = themeKeys.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeKeys.length;
    this.applyTheme(themeKeys[nextIndex]);
  }
}
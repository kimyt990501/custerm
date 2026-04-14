import { useState, useCallback, useEffect } from 'react';

const DEFAULT_SETTINGS: AppSettings = {
  themeName: 'Catppuccin Mocha',
  fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
  fontSize: 14,
  lineHeight: 1.2,
  opacity: 1.0,
  cursorStyle: 'block',
  cursorBlink: true,
  terminalBackgroundOpacity: 1.0,
  terminalBlur: 0,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState<TerminalTheme | null>(null);
  const [themeNames, setThemeNames] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 초기 로드
  useEffect(() => {
    const load = async () => {
      const [s, names] = await Promise.all([
        window.electronAPI.settings.get(),
        window.electronAPI.settings.getThemeNames(),
      ]);
      setSettings(s);
      setThemeNames(names);

      const currentTheme = await window.electronAPI.settings.getTheme(s.themeName);
      setTheme(currentTheme);
      setLoaded(true);
    };
    load();
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = await window.electronAPI.settings.update(partial);
    setSettings(updated);

    // 테마가 변경되면 테마 데이터도 갱신
    if (partial.themeName) {
      const newTheme = await window.electronAPI.settings.getTheme(partial.themeName);
      setTheme(newTheme);
    }

    return updated;
  }, []);

  return {
    settings,
    theme,
    themeNames,
    loaded,
    updateSettings,
  };
}

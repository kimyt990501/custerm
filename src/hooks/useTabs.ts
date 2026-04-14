import { useState, useCallback } from 'react';

export interface Tab {
  id: string;
  title: string;
  type: 'local' | 'ssh' | 'wsl' | 'db';
  ptyId: string | null;
  sshSessionId: string | null;
  profileId?: string;
  /** WSL 탭일 때 배포판 이름 */
  distro?: string;
  /** DB 탭일 때 프로필 id */
  dbProfileId?: string;
}

let nextTabId = 0;

function createTab(
  title: string,
  type: 'local' | 'ssh' | 'wsl' | 'db' = 'local',
  profileId?: string,
  distro?: string,
  dbProfileId?: string,
): Tab {
  const id = String(++nextTabId);
  return {
    id,
    title,
    type,
    ptyId: null,
    sshSessionId: null,
    profileId,
    distro,
    dbProfileId,
  };
}

export function useTabs() {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const initial = createTab('PowerShell', 'local');
    return [initial];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => String(nextTabId));

  const addTab = useCallback((title?: string) => {
    const tab = createTab(title || 'PowerShell', 'local');
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab.id;
  }, []);

  const addSshTab = useCallback((profileName: string, profileId: string) => {
    const tab = createTab(profileName, 'ssh', profileId);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab.id;
  }, []);

  const addWslTab = useCallback((profileName: string, distro: string) => {
    const tab = createTab(profileName, 'wsl', undefined, distro);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab.id;
  }, []);

  const addDbTab = useCallback((profileName: string, dbProfileId: string) => {
    const tab = createTab(profileName, 'db', undefined, undefined, dbProfileId);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab.id;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      if (idx === -1) return prev;

      const next = prev.filter(t => t.id !== tabId);
      if (next.length === 0) return prev;

      setActiveTabId(currentActive => {
        if (currentActive === tabId) {
          const newIdx = Math.min(idx, next.length - 1);
          return next[newIdx].id;
        }
        return currentActive;
      });

      return next;
    });
  }, []);

  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const renameTab = useCallback((tabId: string, newTitle: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, title: newTitle } : t)),
    );
  }, []);

  const setPtyId = useCallback((tabId: string, ptyId: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, ptyId } : t)),
    );
  }, []);

  const setSshSessionId = useCallback((tabId: string, sshSessionId: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, sshSessionId } : t)),
    );
  }, []);

  const nextTab = useCallback(() => {
    setTabs(current => {
      setActiveTabId(prev => {
        const idx = current.findIndex(t => t.id === prev);
        const nextIdx = (idx + 1) % current.length;
        return current[nextIdx].id;
      });
      return current;
    });
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const prevTab = useCallback(() => {
    setTabs(current => {
      setActiveTabId(prev => {
        const idx = current.findIndex(t => t.id === prev);
        const prevIdx = (idx - 1 + current.length) % current.length;
        return current[prevIdx].id;
      });
      return current;
    });
  }, []);

  return {
    tabs,
    activeTabId,
    addTab,
    addSshTab,
    addWslTab,
    addDbTab,
    closeTab,
    switchTab,
    renameTab,
    setPtyId,
    setSshSessionId,
    reorderTabs,
    nextTab,
    prevTab,
  };
}

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseWslTmuxOptions {
  distro: string;
  ptyId: string | null;
}

export function useWslTmux({ distro, ptyId }: UseWslTmuxOptions) {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [tmuxAvailable, setTmuxAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState<string | null>(null);
  const initDone = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.wsl.tmux.list(distro);
      setTmuxAvailable(result.tmuxAvailable);
      setSessions(result.sessions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [distro]);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    refresh();
  }, [refresh]);

  const attach = useCallback((sessionName: string) => {
    if (!ptyId) return;
    window.electronAPI.wsl.tmux.attach(ptyId, sessionName);
    setActiveSessionName(sessionName);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const createSession = useCallback((sessionName?: string) => {
    if (!ptyId) return;
    window.electronAPI.wsl.tmux.new(ptyId, sessionName || undefined);
    setActiveSessionName(sessionName || null);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const detach = useCallback(() => {
    if (!ptyId) return;
    window.electronAPI.wsl.tmux.detach(ptyId);
    setActiveSessionName(null);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const killSession = useCallback(async (sessionName: string) => {
    try {
      setError(null);
      await window.electronAPI.wsl.tmux.kill(distro, sessionName);
      if (activeSessionName === sessionName) setActiveSessionName(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [distro, refresh, activeSessionName]);

  const listWindows = useCallback((sessionName: string) => {
    return window.electronAPI.wsl.tmux.listWindows(distro, sessionName);
  }, [distro]);

  const listPanes = useCallback((sessionName: string, windowIndex: number) => {
    return window.electronAPI.wsl.tmux.listPanes(distro, sessionName, windowIndex);
  }, [distro]);

  const sendKeys = useCallback((keys: string) => {
    if (!ptyId) return;
    window.electronAPI.wsl.tmux.sendKeys(ptyId, keys);
  }, [ptyId]);

  const setMouse = useCallback((on: boolean) => {
    if (!ptyId) return;
    window.electronAPI.wsl.tmux.setMouse(ptyId, on);
  }, [ptyId]);

  return {
    sessions,
    tmuxAvailable,
    loading,
    error,
    setError,
    refresh,
    attach,
    createSession,
    detach,
    killSession,
    activeSessionName,
    listWindows,
    listPanes,
    sendKeys,
    setMouse,
  };
}

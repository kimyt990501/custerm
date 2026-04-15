import { useState, useCallback, useEffect, useRef } from 'react';

interface UseTmuxOptions {
  sshSessionId: string;
}

export function useTmux({ sshSessionId }: UseTmuxOptions) {
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
      const result = await window.electronAPI.tmux.list(sshSessionId);
      setTmuxAvailable(result.tmuxAvailable);
      setSessions(result.sessions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sshSessionId]);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    refresh();
  }, [refresh]);

  const attach = useCallback((sessionName: string) => {
    window.electronAPI.tmux.attach(sshSessionId, sessionName);
    setActiveSessionName(sessionName);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  const createSession = useCallback((sessionName?: string) => {
    window.electronAPI.tmux.new(sshSessionId, sessionName || undefined);
    setActiveSessionName(sessionName || null);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  const detach = useCallback(() => {
    window.electronAPI.tmux.detach(sshSessionId);
    setActiveSessionName(null);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  const killSession = useCallback(async (sessionName: string) => {
    try {
      setError(null);
      await window.electronAPI.tmux.kill(sshSessionId, sessionName);
      if (activeSessionName === sessionName) setActiveSessionName(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [sshSessionId, refresh, activeSessionName]);

  const listWindows = useCallback((sessionName: string) => {
    return window.electronAPI.tmux.listWindows(sshSessionId, sessionName);
  }, [sshSessionId]);

  const listPanes = useCallback((sessionName: string, windowIndex: number) => {
    return window.electronAPI.tmux.listPanes(sshSessionId, sessionName, windowIndex);
  }, [sshSessionId]);

  const sendKeys = useCallback((keys: string) => {
    window.electronAPI.tmux.sendKeys(sshSessionId, keys);
  }, [sshSessionId]);

  const setMouse = useCallback((on: boolean) => {
    window.electronAPI.tmux.setMouse(sshSessionId, on);
  }, [sshSessionId]);

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

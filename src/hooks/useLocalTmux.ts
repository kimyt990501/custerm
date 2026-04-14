import { useState, useCallback, useEffect, useRef } from 'react';

interface UseLocalTmuxOptions {
  ptyId: string | null;
}

export function useLocalTmux({ ptyId }: UseLocalTmuxOptions) {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [tmuxAvailable, setTmuxAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initDone = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.local.tmux.list();
      setTmuxAvailable(result.tmuxAvailable);
      setSessions(result.sessions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    refresh();
  }, [refresh]);

  const attach = useCallback((sessionName: string) => {
    if (!ptyId) return;
    window.electronAPI.local.tmux.attach(ptyId, sessionName);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const createSession = useCallback((sessionName?: string) => {
    if (!ptyId) return;
    window.electronAPI.local.tmux.new(ptyId, sessionName || undefined);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const detach = useCallback(() => {
    if (!ptyId) return;
    window.electronAPI.local.tmux.detach(ptyId);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const killSession = useCallback(async (sessionName: string) => {
    try {
      setError(null);
      await window.electronAPI.local.tmux.kill(sessionName);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [refresh]);

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
  };
}

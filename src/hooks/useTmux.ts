import { useState, useCallback, useEffect, useRef } from 'react';

interface UseTmuxOptions {
  sshSessionId: string;
}

export function useTmux({ sshSessionId }: UseTmuxOptions) {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [tmuxAvailable, setTmuxAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // 마운트 시 자동 조회
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    refresh();
  }, [refresh]);

  const attach = useCallback((sessionName: string) => {
    window.electronAPI.tmux.attach(sshSessionId, sessionName);
    // attach 후 tmux가 화면을 다시 그리도록 resize 이벤트를 발생시킨다.
    // FitAddon이 이 이벤트를 받아 fit() → xterm.onResize → ssh.resize 순으로 처리한다.
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  const createSession = useCallback((sessionName?: string) => {
    window.electronAPI.tmux.new(sshSessionId, sessionName || undefined);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  const detach = useCallback(() => {
    window.electronAPI.tmux.detach(sshSessionId);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  const killSession = useCallback(async (sessionName: string) => {
    try {
      setError(null);
      await window.electronAPI.tmux.kill(sshSessionId, sessionName);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [sshSessionId, refresh]);

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

import { useState, useCallback, useEffect, useRef } from 'react';

interface UsePortForwardingOptions {
  sshSessionId: string;
}

export function usePortForwarding({ sshSessionId }: UsePortForwardingOptions) {
  const [tunnels, setTunnels] = useState<PortForwardingTunnel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const initDone = useRef(false);

  // 초기 로드
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    async function load() {
      try {
        const list = await window.electronAPI.portforward.list(sshSessionId);
        setTunnels(list);
      } catch {
        // 초기 로드 실패는 무시
      }
    }
    load();
  }, [sshSessionId]);

  // 터널 생성
  const createTunnel = useCallback(async (config: PortForwardingConfig) => {
    try {
      setError(null);
      await window.electronAPI.portforward.create(sshSessionId, config);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [sshSessionId]);

  // 터널 닫기
  const closeTunnel = useCallback((tunnelId: string) => {
    window.electronAPI.portforward.close(tunnelId);
    setTunnels(prev => prev.filter(t => t.tunnelId !== tunnelId));
  }, []);

  // 상태 업데이트 리스너
  useEffect(() => {
    const removeStatusUpdate = window.electronAPI.portforward.onStatusUpdate(
      (_tunnelId, tunnel) => {
        setTunnels(prev => {
          const exists = prev.find(t => t.tunnelId === tunnel.tunnelId);
          if (exists) {
            return prev.map(t => t.tunnelId === tunnel.tunnelId ? tunnel : t);
          }
          // 새 터널이 이 세션에 속하면 추가
          if (tunnel.sshSessionId === sshSessionId) {
            return [...prev, tunnel];
          }
          return prev;
        });
      },
    );

    const removeError = window.electronAPI.portforward.onError(
      (_tunnelId, errorMsg) => {
        setError(errorMsg);
      },
    );

    return () => {
      removeStatusUpdate();
      removeError();
    };
  }, [sshSessionId]);

  return {
    tunnels,
    error,
    setError,
    createTunnel,
    closeTunnel,
  };
}

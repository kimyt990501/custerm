import { useState, useCallback, useEffect, useRef } from 'react';

interface UseDockerOptions {
  sshSessionId: string;
}

export function useDocker({ sshSessionId }: UseDockerOptions) {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initDone = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.docker.list(sshSessionId);
      setDockerAvailable(result.dockerAvailable);
      setContainers(result.containers);
      setImages(result.images);
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

  const wrap = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        setError(null);
        await fn();
        await refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [refresh],
  );

  const start = useCallback((id: string) => wrap(() => window.electronAPI.docker.start(sshSessionId, id)), [sshSessionId, wrap]);
  const stop = useCallback((id: string) => wrap(() => window.electronAPI.docker.stop(sshSessionId, id)), [sshSessionId, wrap]);
  const restart = useCallback((id: string) => wrap(() => window.electronAPI.docker.restart(sshSessionId, id)), [sshSessionId, wrap]);
  const remove = useCallback((id: string, force: boolean) => wrap(() => window.electronAPI.docker.remove(sshSessionId, id, force)), [sshSessionId, wrap]);
  const removeImage = useCallback((id: string, force: boolean) => wrap(() => window.electronAPI.docker.removeImage(sshSessionId, id, force)), [sshSessionId, wrap]);
  const pullImage = useCallback((ref: string) => wrap(async () => { await window.electronAPI.docker.pullImage(sshSessionId, ref); }), [sshSessionId, wrap]);

  const execInto = useCallback((name: string, shell = 'sh') => {
    window.electronAPI.docker.exec(sshSessionId, name, shell);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  const showLogs = useCallback((name: string) => {
    window.electronAPI.docker.logs(sshSessionId, name);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [sshSessionId]);

  return {
    containers,
    images,
    dockerAvailable,
    loading,
    error,
    setError,
    refresh,
    start,
    stop,
    restart,
    remove,
    removeImage,
    pullImage,
    execInto,
    showLogs,
  };
}

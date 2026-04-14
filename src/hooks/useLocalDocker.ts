import { useState, useCallback, useEffect, useRef } from 'react';

interface UseLocalDockerOptions {
  ptyId: string | null;
}

export function useLocalDocker({ ptyId }: UseLocalDockerOptions) {
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
      const result = await window.electronAPI.local.docker.list();
      setDockerAvailable(result.dockerAvailable);
      setContainers(result.containers);
      setImages(result.images);
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

  const start = useCallback((id: string) => wrap(() => window.electronAPI.local.docker.start(id)), [wrap]);
  const stop = useCallback((id: string) => wrap(() => window.electronAPI.local.docker.stop(id)), [wrap]);
  const restart = useCallback((id: string) => wrap(() => window.electronAPI.local.docker.restart(id)), [wrap]);
  const remove = useCallback((id: string, force: boolean) => wrap(() => window.electronAPI.local.docker.remove(id, force)), [wrap]);
  const removeImage = useCallback((id: string, force: boolean) => wrap(() => window.electronAPI.local.docker.removeImage(id, force)), [wrap]);
  const pullImage = useCallback((ref: string) => wrap(async () => { await window.electronAPI.local.docker.pullImage(ref); }), [wrap]);

  const execInto = useCallback((name: string, shell = 'sh') => {
    if (!ptyId) return;
    window.electronAPI.local.docker.exec(ptyId, name, shell);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const showLogs = useCallback((name: string) => {
    if (!ptyId) return;
    window.electronAPI.local.docker.logs(ptyId, name);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

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

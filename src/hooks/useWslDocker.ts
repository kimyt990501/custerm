import { useState, useCallback, useEffect, useRef } from 'react';

interface UseWslDockerOptions {
  distro: string;
  ptyId: string | null;
}

export function useWslDocker({ distro, ptyId }: UseWslDockerOptions) {
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
      const result = await window.electronAPI.wsl.docker.list(distro);
      setDockerAvailable(result.dockerAvailable);
      setContainers(result.containers);
      setImages(result.images);
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

  const start = useCallback((id: string) => wrap(() => window.electronAPI.wsl.docker.start(distro, id)), [distro, wrap]);
  const stop = useCallback((id: string) => wrap(() => window.electronAPI.wsl.docker.stop(distro, id)), [distro, wrap]);
  const restart = useCallback((id: string) => wrap(() => window.electronAPI.wsl.docker.restart(distro, id)), [distro, wrap]);
  const remove = useCallback((id: string, force: boolean) => wrap(() => window.electronAPI.wsl.docker.remove(distro, id, force)), [distro, wrap]);
  const removeImage = useCallback((id: string, force: boolean) => wrap(() => window.electronAPI.wsl.docker.removeImage(distro, id, force)), [distro, wrap]);
  const pullImage = useCallback((ref: string) => wrap(async () => { await window.electronAPI.wsl.docker.pullImage(distro, ref); }), [distro, wrap]);

  const execInto = useCallback((name: string, shell = 'sh') => {
    if (!ptyId) return;
    window.electronAPI.wsl.docker.exec(ptyId, name, shell);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }, [ptyId]);

  const showLogs = useCallback((name: string) => {
    if (!ptyId) return;
    window.electronAPI.wsl.docker.logs(ptyId, name);
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

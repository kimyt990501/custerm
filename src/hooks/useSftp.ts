import { useState, useCallback, useEffect, useRef } from 'react';

interface UseSftpOptions {
  sshSessionId: string;
}

export function useSftp({ sshSessionId }: UseSftpOptions) {
  const [sftpId, setSftpId] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string>('');
  const [remotePath, setRemotePath] = useState<string>('/');
  const [localFiles, setLocalFiles] = useState<SftpFileEntry[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<SftpFileEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sftpIdRef = useRef<string | null>(null);
  const localPathRef = useRef<string>('');
  const remotePathRef = useRef<string>('/');
  const initDone = useRef(false);

  // 경로 ref를 상태와 동기화
  localPathRef.current = localPath;
  remotePathRef.current = remotePath;

  // 로컬 디렉토리 읽기
  const refreshLocal = useCallback(async (dirPath?: string) => {
    const target = dirPath ?? localPathRef.current;
    if (!target) return;

    setLocalLoading(true);
    try {
      const files = await window.electronAPI.local.readdir(target);
      setLocalFiles(files);
      if (dirPath && dirPath !== localPathRef.current) {
        setLocalPath(dirPath);
      }
    } catch (err) {
      setError(`로컬 디렉토리 읽기 실패: ${(err as Error).message}`);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // 원격 디렉토리 읽기
  const refreshRemote = useCallback(async (dirPath?: string) => {
    const id = sftpIdRef.current;
    if (!id) return;

    const target = dirPath ?? remotePathRef.current;
    setRemoteLoading(true);
    try {
      const files = await window.electronAPI.sftp.readdir(id, target);
      setRemoteFiles(files);
      if (dirPath && dirPath !== remotePathRef.current) {
        setRemotePath(dirPath);
      }
    } catch (err) {
      setError(`원격 디렉토리 읽기 실패: ${(err as Error).message}`);
    } finally {
      setRemoteLoading(false);
    }
  }, []);

  // SFTP 세션 열기 + 초기 로드
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    async function init() {
      try {
        setError(null);
        const { sftpId: id } = await window.electronAPI.sftp.open(sshSessionId);
        setSftpId(id);
        sftpIdRef.current = id;

        // 홈 디렉토리로 초기화
        const home = await window.electronAPI.local.homedir();
        setLocalPath(home);
        localPathRef.current = home;

        // 초기 디렉토리 로드
        await Promise.all([
          refreshLocal(home),
          refreshRemote('/'),
        ]);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    init();
  }, [sshSessionId, refreshLocal, refreshRemote]);

  // 로컬 디렉토리 탐색
  const navigateLocal = useCallback((dirName: string) => {
    const currentLocal = localPathRef.current;
    let newPath: string;
    if (dirName === '..') {
      const sep = currentLocal.includes('/') ? '/' : '\\';
      const parts = currentLocal.split(sep);
      parts.pop();
      newPath = parts.join(sep) || (sep === '/' ? '/' : parts[0] + sep);
    } else {
      const sep = currentLocal.includes('/') ? '/' : '\\';
      newPath = currentLocal + (currentLocal.endsWith(sep) ? '' : sep) + dirName;
    }
    refreshLocal(newPath);
  }, [refreshLocal]);

  // 원격 디렉토리 탐색
  const navigateRemote = useCallback((dirName: string) => {
    const currentRemote = remotePathRef.current;
    let newPath: string;
    if (dirName === '..') {
      const parts = currentRemote.split('/').filter(Boolean);
      parts.pop();
      newPath = '/' + parts.join('/');
    } else {
      newPath = currentRemote === '/' ? `/${dirName}` : `${currentRemote}/${dirName}`;
    }
    refreshRemote(newPath);
  }, [refreshRemote]);

  // 업로드
  const upload = useCallback(async (localFilePath: string, remoteFilePath: string, filename: string) => {
    const id = sftpIdRef.current;
    if (!id) return;

    try {
      const { transferId } = await window.electronAPI.sftp.upload(id, localFilePath, remoteFilePath);
      setTransfers(prev => [...prev, {
        transferId,
        direction: 'upload' as const,
        localPath: localFilePath,
        remotePath: remoteFilePath,
        filename,
        totalBytes: 0,
        transferredBytes: 0,
        status: 'active' as const,
      }]);
    } catch (err) {
      setError(`업로드 실패: ${(err as Error).message}`);
    }
  }, []);

  // 다운로드
  const download = useCallback(async (remoteFilePath: string, localFilePath: string, filename: string) => {
    const id = sftpIdRef.current;
    if (!id) return;

    try {
      const { transferId } = await window.electronAPI.sftp.download(id, remoteFilePath, localFilePath);
      setTransfers(prev => [...prev, {
        transferId,
        direction: 'download' as const,
        localPath: localFilePath,
        remotePath: remoteFilePath,
        filename,
        totalBytes: 0,
        transferredBytes: 0,
        status: 'active' as const,
      }]);
    } catch (err) {
      setError(`다운로드 실패: ${(err as Error).message}`);
    }
  }, []);

  // 전송 취소
  const cancelTransfer = useCallback((transferId: string) => {
    window.electronAPI.sftp.cancelTransfer(transferId);
    setTransfers(prev => prev.filter(t => t.transferId !== transferId));
  }, []);

  // 완료된 전송 제거
  const dismissTransfer = useCallback((transferId: string) => {
    setTransfers(prev => prev.filter(t => t.transferId !== transferId));
  }, []);

  // 원격 파일 삭제
  const deleteRemote = useCallback(async (filePath: string) => {
    const id = sftpIdRef.current;
    if (!id) return;

    try {
      await window.electronAPI.sftp.delete(id, filePath);
      refreshRemote();
    } catch (err) {
      setError(`삭제 실패: ${(err as Error).message}`);
    }
  }, [refreshRemote]);

  // 원격 디렉토리 삭제
  const rmdirRemote = useCallback(async (dirPath: string) => {
    const id = sftpIdRef.current;
    if (!id) return;

    try {
      await window.electronAPI.sftp.rmdir(id, dirPath);
      refreshRemote();
    } catch (err) {
      setError(`디렉토리 삭제 실패: ${(err as Error).message}`);
    }
  }, [refreshRemote]);

  // 원격 디렉토리 생성
  const mkdirRemote = useCallback(async (dirName: string) => {
    const id = sftpIdRef.current;
    if (!id) return;

    const currentRemote = remotePathRef.current;
    const fullPath = currentRemote === '/' ? `/${dirName}` : `${currentRemote}/${dirName}`;
    try {
      await window.electronAPI.sftp.mkdir(id, fullPath);
      refreshRemote();
    } catch (err) {
      setError(`디렉토리 생성 실패: ${(err as Error).message}`);
    }
  }, [refreshRemote]);

  // 원격 이름 변경
  const renameRemote = useCallback(async (oldName: string, newName: string) => {
    const id = sftpIdRef.current;
    if (!id) return;

    const currentRemote = remotePathRef.current;
    const oldPath = currentRemote === '/' ? `/${oldName}` : `${currentRemote}/${oldName}`;
    const newPath = currentRemote === '/' ? `/${newName}` : `${currentRemote}/${newName}`;
    try {
      await window.electronAPI.sftp.rename(id, oldPath, newPath);
      refreshRemote();
    } catch (err) {
      setError(`이름 변경 실패: ${(err as Error).message}`);
    }
  }, [refreshRemote]);

  // 전송 이벤트 리스너
  useEffect(() => {
    const removeProgress = window.electronAPI.sftp.onTransferProgress(
      (transferId, transferred, total) => {
        setTransfers(prev =>
          prev.map(t =>
            t.transferId === transferId
              ? { ...t, transferredBytes: transferred, totalBytes: total, status: 'active' as const }
              : t
          ),
        );
      },
    );

    const removeComplete = window.electronAPI.sftp.onTransferComplete(
      (transferId) => {
        setTransfers(prev =>
          prev.map(t =>
            t.transferId === transferId ? { ...t, status: 'completed' as const } : t
          ),
        );
        // 완료 시 양쪽 패널 새로고침
        refreshLocal();
        refreshRemote();
      },
    );

    const removeError = window.electronAPI.sftp.onTransferError(
      (transferId, errorMsg) => {
        setTransfers(prev =>
          prev.map(t =>
            t.transferId === transferId
              ? { ...t, status: 'failed' as const, error: errorMsg }
              : t
          ),
        );
      },
    );

    return () => {
      removeProgress();
      removeComplete();
      removeError();
    };
  }, [refreshLocal, refreshRemote]);

  // 정리
  useEffect(() => {
    return () => {
      if (sftpIdRef.current) {
        window.electronAPI.sftp.close(sftpIdRef.current);
      }
    };
  }, []);

  return {
    sftpId,
    localPath,
    remotePath,
    localFiles,
    remoteFiles,
    localLoading,
    remoteLoading,
    transfers,
    error,
    setError,
    refreshLocal,
    refreshRemote,
    navigateLocal,
    navigateRemote,
    upload,
    download,
    cancelTransfer,
    dismissTransfer,
    deleteRemote,
    rmdirRemote,
    mkdirRemote,
    renameRemote,
  };
}

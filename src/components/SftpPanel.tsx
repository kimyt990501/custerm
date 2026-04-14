import { useCallback } from 'react';
import { useSftp } from '../hooks/useSftp';
import FileList from './FileList';
import TransferProgress from './TransferProgress';

interface SftpPanelProps {
  sshSessionId: string;
}

function SftpPanel({ sshSessionId }: SftpPanelProps) {
  const {
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
  } = useSftp({ sshSessionId });

  const handleUpload = useCallback((srcLocalPath: string, dstRemotePath: string, filename: string) => {
    upload(srcLocalPath, dstRemotePath, filename);
  }, [upload]);

  const handleDownload = useCallback((srcRemotePath: string, dstLocalPath: string, filename: string) => {
    download(srcRemotePath, dstLocalPath, filename);
  }, [download]);

  if (!sftpId && !error) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0b14]/30 text-[#9399b2] text-sm">
        SFTP 연결 중...
      </div>
    );
  }

  if (error && !sftpId) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0b14]/30 text-[#f38ba8] text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#181825]/70 backdrop-blur-md">
      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f38ba8]/10 border-b border-[#f38ba8]/10">
          <span className="text-xs text-[#f38ba8] flex-1 truncate">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-[#f38ba8]/60 hover:text-[#f38ba8] transition-colors"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* 듀얼 패널 */}
      <div className="flex-1 flex flex-row min-h-0">
        {/* 로컬 패널 */}
        <div className="w-1/2 border-r border-white/5 flex flex-col min-h-0">
          <FileList
            files={localFiles}
            currentPath={localPath}
            side="local"
            loading={localLoading}
            onNavigate={navigateLocal}
            onDownload={handleDownload}
            onUpload={handleUpload}
            localPath={localPath}
            remotePath={remotePath}
          />
        </div>

        {/* 원격 패널 */}
        <div className="w-1/2 flex flex-col min-h-0">
          <FileList
            files={remoteFiles}
            currentPath={remotePath}
            side="remote"
            loading={remoteLoading}
            onNavigate={navigateRemote}
            onDelete={deleteRemote}
            onRmdir={rmdirRemote}
            onRename={renameRemote}
            onMkdir={mkdirRemote}
            onDownload={handleDownload}
            onUpload={handleUpload}
            localPath={localPath}
            remotePath={remotePath}
          />
        </div>
      </div>

      {/* 전송 진행률 */}
      <TransferProgress
        transfers={transfers}
        onCancel={cancelTransfer}
        onDismiss={dismissTransfer}
      />
    </div>
  );
}

export default SftpPanel;

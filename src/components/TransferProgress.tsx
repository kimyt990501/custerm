import { useEffect, useRef } from 'react';

interface TransferProgressProps {
  transfers: TransferItem[];
  onCancel: (transferId: string) => void;
  onDismiss: (transferId: string) => void;
}

function TransferProgress({ transfers, onCancel, onDismiss }: TransferProgressProps) {
  if (transfers.length === 0) return null;

  return (
    <div className="border-t border-white/5 bg-[#0b0b14]/40 max-h-32 overflow-y-auto">
      <div className="px-2 py-1 text-[10px] text-[#9399b2] font-medium uppercase tracking-wider border-b border-white/5">
        전송 ({transfers.length})
      </div>
      {transfers.map(t => (
        <TransferRow key={t.transferId} transfer={t} onCancel={onCancel} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function TransferRow({
  transfer,
  onCancel,
  onDismiss,
}: {
  transfer: TransferItem;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (transfer.status === 'completed') {
      dismissTimer.current = setTimeout(() => {
        onDismiss(transfer.transferId);
      }, 5000);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [transfer.status, transfer.transferId, onDismiss]);

  const percentage = transfer.totalBytes > 0
    ? Math.round((transfer.transferredBytes / transfer.totalBytes) * 100)
    : 0;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
      {/* 방향 아이콘 */}
      <span className="text-[10px] shrink-0">
        {transfer.direction === 'upload' ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 10V2M3 5l3-3 3 3" stroke="#a6e3a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M3 7l3 3 3-3" stroke="#89b4fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* 파일명 */}
      <span className="text-xs text-[#cdd6f4] truncate min-w-0 flex-shrink" title={transfer.filename}>
        {transfer.filename}
      </span>

      {/* 프로그레스 바 */}
      <div className="flex-1 min-w-[60px]">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              transfer.status === 'failed' ? 'bg-[#f38ba8]'
                : transfer.status === 'completed' ? 'bg-[#a6e3a1]'
                : 'bg-[#89b4fa]'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* 상태 텍스트 */}
      <span className="text-[10px] text-[#9399b2] whitespace-nowrap shrink-0">
        {transfer.status === 'active' && `${formatBytes(transfer.transferredBytes)} / ${formatBytes(transfer.totalBytes)}`}
        {transfer.status === 'completed' && '완료'}
        {transfer.status === 'failed' && (
          <span className="text-[#f38ba8]" title={transfer.error}>실패</span>
        )}
        {transfer.status === 'queued' && '대기'}
      </span>

      {/* 취소/닫기 버튼 */}
      {(transfer.status === 'active' || transfer.status === 'queued') && (
        <button
          onClick={() => onCancel(transfer.transferId)}
          className="w-4 h-4 flex items-center justify-center text-[#9399b2] hover:text-[#f38ba8] shrink-0"
          title="취소"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {(transfer.status === 'completed' || transfer.status === 'failed') && (
        <button
          onClick={() => onDismiss(transfer.transferId)}
          className="w-4 h-4 flex items-center justify-center text-[#9399b2] hover:text-[#cdd6f4] shrink-0"
          title="닫기"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default TransferProgress;

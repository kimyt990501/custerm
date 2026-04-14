import { useState, useCallback, useRef, useEffect } from 'react';

interface FileListProps {
  files: SftpFileEntry[];
  currentPath: string;
  side: 'local' | 'remote';
  loading: boolean;
  onNavigate: (dirName: string) => void;
  onUpload?: (localPath: string, remotePath: string, filename: string) => void;
  onDownload?: (remotePath: string, localPath: string, filename: string) => void;
  onDelete?: (path: string) => void;
  onRmdir?: (path: string) => void;
  onRename?: (oldName: string, newName: string) => void;
  onMkdir?: (dirName: string) => void;
  /** 드래그 시작 시 호출 — 상대편 패널에서 드롭 처리에 사용 */
  localPath?: string;
  remotePath?: string;
}

function FileList({
  files,
  currentPath,
  side,
  loading,
  onNavigate,
  onDelete,
  onRmdir,
  onRename,
  onMkdir,
  onUpload,
  onDownload,
  localPath,
  remotePath,
}: FileListProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: SftpFileEntry } | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [mkdirMode, setMkdirMode] = useState(false);
  const [mkdirValue, setMkdirValue] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 컨텍스트 메뉴가 화면 밖으로 나가지 않도록 위치 조정
  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    let { x, y } = contextMenu;
    if (rect.bottom > window.innerHeight) {
      y = window.innerHeight - rect.height - 4;
    }
    if (rect.right > window.innerWidth) {
      x = window.innerWidth - rect.width - 4;
    }
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu({ ...contextMenu, x, y });
    }
  }, [contextMenu]);

  const handleClick = useCallback((filename: string, e: React.MouseEvent) => {
    if (e.ctrlKey) {
      setSelectedFiles(prev => {
        const next = new Set(prev);
        if (next.has(filename)) next.delete(filename);
        else next.add(filename);
        return next;
      });
    } else {
      setSelectedFiles(new Set([filename]));
    }
  }, []);

  const handleDoubleClick = useCallback((file: SftpFileEntry) => {
    if (file.isDirectory) {
      onNavigate(file.filename);
      setSelectedFiles(new Set());
    }
  }, [onNavigate]);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: SftpFileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (renameTarget && renameValue.trim() && renameValue !== renameTarget && onRename) {
      onRename(renameTarget, renameValue.trim());
    }
    setRenameTarget(null);
    setRenameValue('');
  }, [renameTarget, renameValue, onRename]);

  const handleMkdirSubmit = useCallback(() => {
    if (mkdirValue.trim() && onMkdir) {
      onMkdir(mkdirValue.trim());
    }
    setMkdirMode(false);
    setMkdirValue('');
  }, [mkdirValue, onMkdir]);

  // 드래그 앤 드롭
  const handleDragStart = useCallback((e: React.DragEvent, file: SftpFileEntry) => {
    const data = JSON.stringify({ side, path: currentPath, filename: file.filename });
    e.dataTransfer.setData('application/x-sftp-transfer', data);
    e.dataTransfer.effectAllowed = 'copy';
  }, [side, currentPath]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    // OS 파일 탐색기에서 드롭
    if (e.dataTransfer.files.length > 0 && side === 'remote' && remotePath && onUpload) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const filePath = (file as unknown as { path: string }).path;
        if (filePath) {
          const filename = filePath.split(/[/\\]/).pop() || file.name;
          const remoteTarget = remotePath === '/' ? `/${filename}` : `${remotePath}/${filename}`;
          onUpload(filePath, remoteTarget, filename);
        }
      }
      return;
    }

    // 패널 간 드래그
    const raw = e.dataTransfer.getData('application/x-sftp-transfer');
    if (!raw) return;

    const data = JSON.parse(raw) as { side: string; path: string; filename: string };

    if (data.side === side) return; // 같은 패널 내 드롭은 무시

    if (data.side === 'local' && side === 'remote' && onUpload) {
      // 로컬 → 원격 업로드
      const sep = data.path.includes('/') ? '/' : '\\';
      const srcPath = data.path + (data.path.endsWith(sep) ? '' : sep) + data.filename;
      const dstPath = currentPath === '/' ? `/${data.filename}` : `${currentPath}/${data.filename}`;
      onUpload(srcPath, dstPath, data.filename);
    } else if (data.side === 'remote' && side === 'local' && onDownload && localPath) {
      // 원격 → 로컬 다운로드
      const srcPath = data.path === '/' ? `/${data.filename}` : `${data.path}/${data.filename}`;
      const sep = localPath.includes('/') ? '/' : '\\';
      const dstPath = localPath + (localPath.endsWith(sep) ? '' : sep) + data.filename;
      onDownload(srcPath, dstPath, data.filename);
    }
  }, [side, currentPath, localPath, remotePath, onUpload, onDownload]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (ms: number): string => {
    if (!ms) return '-';
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div
      className={`flex flex-col h-full select-none transition-colors ${dragOver ? 'bg-[#89b4fa]/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={closeContextMenu}
    >
      {/* 경로 바 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/15">
        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded shrink-0 ${
          side === 'local'
            ? 'bg-[#a6e3a1]/15 text-[#a6e3a1]'
            : 'bg-[#89b4fa]/15 text-[#89b4fa]'
        }`}>
          {side === 'local' ? '로컬' : '원격'}
        </span>
        <span className="text-[11px] text-[#bac2de] truncate flex-1 font-mono" title={currentPath}>
          {currentPath}
        </span>
        {side === 'remote' && onMkdir && (
          <button
            onClick={() => { setMkdirMode(true); setMkdirValue(''); }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 transition-colors"
            title="새 폴더"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* 파일 목록 */}
      <div className="flex-1 overflow-y-auto text-xs">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[#9399b2]">
            불러오는 중...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-[#9399b2] border-b border-white/5 sticky top-0 bg-[#181825]/90 backdrop-blur-sm">
                <th className="text-left py-1 px-2 font-medium">이름</th>
                <th className="text-right py-1 px-2 font-medium w-20">크기</th>
                <th className="text-right py-1 px-2 font-medium w-32">수정일</th>
              </tr>
            </thead>
            <tbody>
              {/* 상위 디렉토리 */}
              <tr
                className="hover:bg-white/[0.03] cursor-pointer"
                onDoubleClick={() => onNavigate('..')}
              >
                <td className="py-0.5 px-2 flex items-center gap-1">
                  <FolderIcon />
                  <span className="text-[#cdd6f4]">..</span>
                </td>
                <td className="text-right py-0.5 px-2 text-[#9399b2]">-</td>
                <td className="text-right py-0.5 px-2 text-[#9399b2]">-</td>
              </tr>

              {/* 새 폴더 입력 행 */}
              {mkdirMode && (
                <tr className="bg-[#313244]/30">
                  <td colSpan={3} className="py-0.5 px-2">
                    <div className="flex items-center gap-1">
                      <FolderIcon />
                      <input
                        autoFocus
                        className="bg-[#313244] text-[#cdd6f4] text-xs px-1 py-0.5 rounded border border-[#45475a] outline-none focus:border-[#89b4fa] flex-1"
                        value={mkdirValue}
                        onChange={e => setMkdirValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleMkdirSubmit();
                          if (e.key === 'Escape') { setMkdirMode(false); setMkdirValue(''); }
                        }}
                        onBlur={handleMkdirSubmit}
                        placeholder="폴더 이름"
                      />
                    </div>
                  </td>
                </tr>
              )}

              {/* 파일/디렉토리 목록 */}
              {files.map(file => (
                <tr
                  key={file.filename}
                  className={`hover:bg-white/[0.03] cursor-pointer ${
                    selectedFiles.has(file.filename) ? 'bg-[#89b4fa]/10' : ''
                  }`}
                  onClick={e => handleClick(file.filename, e)}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onContextMenu={e => side === 'remote' ? handleContextMenu(e, file) : undefined}
                  draggable={!file.isDirectory}
                  onDragStart={e => handleDragStart(e, file)}
                >
                  <td className="py-0.5 px-2">
                    <div className="flex items-center gap-1 min-w-0">
                      {file.isDirectory ? <FolderIcon /> : <FileIcon />}
                      {renameTarget === file.filename ? (
                        <input
                          autoFocus
                          className="bg-[#313244] text-[#cdd6f4] text-xs px-1 py-0.5 rounded border border-[#45475a] outline-none focus:border-[#89b4fa] flex-1 min-w-0"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameSubmit();
                            if (e.key === 'Escape') { setRenameTarget(null); setRenameValue(''); }
                          }}
                          onBlur={handleRenameSubmit}
                        />
                      ) : (
                        <span className={`truncate ${file.isDirectory ? 'text-[#89b4fa]' : 'text-[#cdd6f4]'}`}>
                          {file.filename}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-right py-0.5 px-2 text-[#9399b2] whitespace-nowrap">
                    {file.isDirectory ? '-' : formatSize(file.size)}
                  </td>
                  <td className="text-right py-0.5 px-2 text-[#9399b2] whitespace-nowrap">
                    {formatDate(file.modifyTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[#181825]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.file.isDirectory && (
            <ContextMenuItem
              label="다운로드"
              onClick={() => {
                if (onDownload && localPath && remotePath) {
                  const srcPath = remotePath === '/'
                    ? `/${contextMenu.file.filename}`
                    : `${remotePath}/${contextMenu.file.filename}`;
                  const sep = localPath.includes('/') ? '/' : '\\';
                  const dstPath = localPath + (localPath.endsWith(sep) ? '' : sep) + contextMenu.file.filename;
                  onDownload(srcPath, dstPath, contextMenu.file.filename);
                }
                closeContextMenu();
              }}
            />
          )}
          <ContextMenuItem
            label="이름 변경"
            onClick={() => {
              setRenameTarget(contextMenu.file.filename);
              setRenameValue(contextMenu.file.filename);
              closeContextMenu();
            }}
          />
          <ContextMenuItem
            label="삭제"
            onClick={() => {
              const fullPath = currentPath === '/'
                ? `/${contextMenu.file.filename}`
                : `${currentPath}/${contextMenu.file.filename}`;
              if (contextMenu.file.isDirectory) {
                onRmdir?.(fullPath);
              } else {
                onDelete?.(fullPath);
              }
              closeContextMenu();
            }}
            danger
          />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.06] transition-colors ${
        danger ? 'text-[#f38ba8]' : 'text-[#cdd6f4]'
      }`}
    >
      {label}
    </button>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path
        d="M2 3.5C2 2.95 2.45 2.5 3 2.5h2.5l1.5 1.5H11c.55 0 1 .45 1 1v5c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1v-6z"
        fill="#f9e2af"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path
        d="M4 1.5h4l3 3v7c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1v-9c0-.55.45-1 1-1z"
        fill="#6c7086"
      />
      <path d="M8 1.5v3h3" fill="#585b70" />
    </svg>
  );
}

export default FileList;

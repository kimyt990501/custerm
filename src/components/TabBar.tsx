import { useState, useRef, useEffect } from 'react';
import type { Tab } from '../hooks/useTabs';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onAdd: () => void;
  onRename: (tabId: string, newTitle: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

function TabBar({
  tabs, activeTabId, onSwitch, onClose, onAdd, onRename, onReorder,
  sidebarOpen, onToggleSidebar,
}: TabBarProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  return (
    <div
      className="h-10 bg-gradient-to-b from-[#181825] to-[#11111b] backdrop-blur-xl flex items-center border-b border-white/5 select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 사이드바 토글 */}
      <button
        onClick={onToggleSidebar}
        className={`w-10 h-10 flex items-center justify-center transition-colors shrink-0 ${
          sidebarOpen
            ? 'text-[#3ddc97]'
            : 'text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5'
        }`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="프로필 사이드바 (Ctrl+B)"
      >
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
          <line x1="5" y1="2" x2="5" y2="12" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>

      {/* 수직 분리선 */}
      <div className="w-px h-5 bg-white/5 shrink-0" />

      {/* 탭 목록 */}
      <div className="flex-1 flex items-center overflow-x-auto min-w-0 h-10 scrollbar-hide px-1 gap-0.5">
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            index={index}
            isActive={tab.id === activeTabId}
            isDragOver={dragOverIndex === index}
            onSwitch={onSwitch}
            onClose={onClose}
            onRename={onRename}
            canClose={tabs.length > 1}
            onDragStart={() => { dragIndexRef.current = index; }}
            onDragOver={setDragOverIndex}
            onDrop={(toIndex) => {
              if (dragIndexRef.current !== null && dragIndexRef.current !== toIndex) {
                onReorder(dragIndexRef.current, toIndex);
              }
              dragIndexRef.current = null;
              setDragOverIndex(null);
            }}
            onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null); }}
          />
        ))}

        {/* 새 탭 버튼 — 탭 목록 옆에 바짝 붙임 */}
        <button
          onClick={onAdd}
          className="w-7 h-7 ml-1 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 transition-colors shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title="새 탭 (Ctrl+T)"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 창 컨트롤 */}
      <div
        className="flex items-center shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <WindowBtn onClick={() => window.electronAPI.windowMinimize()} title="최소화">
          <svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1" /></svg>
        </WindowBtn>
        <WindowBtn onClick={() => window.electronAPI.windowMaximize()} title="최대화">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.5" y="0.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
          </svg>
        </WindowBtn>
        <WindowBtn onClick={() => window.electronAPI.windowClose()} title="닫기" danger>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </WindowBtn>
      </div>
    </div>
  );
}

function WindowBtn({
  onClick, title, children, danger,
}: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-10 flex items-center justify-center transition-colors text-[#9399b2] hover:text-[#cdd6f4] ${
        danger ? 'hover:bg-[#e64553]' : 'hover:bg-white/5'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

interface TabItemProps {
  tab: Tab;
  index: number;
  isActive: boolean;
  isDragOver: boolean;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onRename: (tabId: string, newTitle: string) => void;
  canClose: boolean;
  onDragStart: () => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
}

function TabItem({
  tab, index, isActive, isDragOver, onSwitch, onClose, onRename, canClose,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: TabItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setEditValue(tab.title);
    setIsEditing(true);
  };

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.title) {
      onRename(tab.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    else if (e.key === 'Escape') setIsEditing(false);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(tab.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 && canClose) {
      e.preventDefault();
      onClose(tab.id);
    }
  };

  return (
    <div
      className={`
        group relative flex items-center gap-2 h-8 px-3 min-w-[110px] max-w-[220px] cursor-pointer rounded-md
        transition-all duration-150
        ${isActive
          ? 'bg-[#1e1e2e] text-[#cdd6f4] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]'
          : 'bg-transparent text-[#9399b2] hover:bg-white/5 hover:text-[#bac2de]'
        }
        ${isDragOver ? 'ring-1 ring-[#3ddc97]/60' : ''}
      `}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      draggable={!isEditing}
      onClick={() => onSwitch(tab.id)}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tab.id);
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      onDragEnd={onDragEnd}
    >
      {/* 활성 탭 하단 글로우 라인 */}
      {isActive && (
        <div className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-[#3ddc97] shadow-[0_0_8px_rgba(61,220,151,0.7)]" />
      )}

      {/* 탭 타입 아이콘 */}
      <TabIcon type={tab.type} active={isActive} />

      {/* 탭 제목 / 편집 */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-[#11111b] text-[#cdd6f4] text-[12px] px-1.5 py-0.5 rounded outline-none border border-[#3ddc97]/60"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate text-[12px] font-medium">{tab.title}</span>
      )}

      {/* 닫기 버튼 */}
      {canClose && !isEditing && (
        <button
          onClick={handleClose}
          className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-[#bac2de] hover:text-[#cdd6f4] transition-all"
          title="탭 닫기"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function TabIcon({ type, active }: { type: Tab['type']; active: boolean }) {
  const color = active
    ? (type === 'wsl' ? 'text-[#fab387]' : type === 'db' ? 'text-[#f38ba8]' : 'text-[#3ddc97]')
    : 'text-[#585b70]';

  if (type === 'db') {
    return (
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className={`shrink-0 ${color}`}>
        <ellipse cx="7" cy="3.2" rx="5" ry="1.7" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 3.2v7.6c0 .94 2.24 1.7 5 1.7s5-.76 5-1.7V3.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 7c0 .94 2.24 1.7 5 1.7S12 7.94 12 7" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (type === 'wsl') {
    return (
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className={`shrink-0 ${color}`}>
        <circle cx="7" cy="5" r="3.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.5 9C4.5 9 5.5 12 7 12S9.5 9 9.5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'ssh') {
    return (
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className={`shrink-0 ${color}`}>
        <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 6.5l1.5 1.5L4 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // local
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className={`shrink-0 ${color}`}>
      <rect x="1" y="2.5" width="12" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 6l2 1.5-2 1.5M6.5 9.2h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default TabBar;

import { useState } from 'react';
import { motion } from 'framer-motion';

interface SidebarProps {
  profiles: SshProfile[];
  onConnect: (profile: SshProfile) => void;
  onCreateProfile: () => void;
  onEditProfile: (profile: SshProfile) => void;
  onDeleteProfile: (id: string) => Promise<void>;
  dbProfiles: DbProfile[];
  onOpenDb: (profile: DbProfile) => void;
  onCreateDbProfile: () => void;
  onEditDbProfile: (profile: DbProfile) => void;
  onDeleteDbProfile: (id: string) => Promise<void>;
  onOpenSettings: () => void;
}

function Sidebar({
  profiles,
  onConnect,
  onCreateProfile,
  onEditProfile,
  onDeleteProfile,
  dbProfiles,
  onOpenDb,
  onCreateDbProfile,
  onEditDbProfile,
  onDeleteDbProfile,
  onOpenSettings,
}: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<{ profileId: string; x: number; y: number } | null>(null);
  const [dbContextMenu, setDbContextMenu] = useState<{ profileId: string; x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, profile: SshProfile) => {
    e.preventDefault();
    setContextMenu({ profileId: profile.id, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleEdit = (profile: SshProfile) => {
    closeContextMenu();
    onEditProfile(profile);
  };

  const handleDelete = async (id: string) => {
    closeContextMenu();
    await onDeleteProfile(id);
  };

  const handleDbContextMenu = (e: React.MouseEvent, profile: DbProfile) => {
    e.preventDefault();
    setDbContextMenu({ profileId: profile.id, x: e.clientX, y: e.clientY });
  };

  const closeDbContextMenu = () => setDbContextMenu(null);

  const handleDbEdit = (profile: DbProfile) => {
    closeDbContextMenu();
    onEditDbProfile(profile);
  };

  const handleDbDelete = async (id: string) => {
    closeDbContextMenu();
    await onDeleteDbProfile(id);
  };

  const closeAllMenus = () => { closeContextMenu(); closeDbContextMenu(); };

  return (
    <motion.div
      initial={{ x: -240, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -240, opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      className="w-64 bg-gradient-to-b from-[#181825] to-[#11111b] backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0 select-none z-20"
      onClick={closeAllMenus}
    >
      {/* SSH/WSL 섹션 */}
      <SectionHeader title="서버 프로필" count={profiles.length} onAdd={onCreateProfile} />

      <div className="flex-1 overflow-y-auto py-1.5 min-h-0">
        {profiles.length === 0 ? (
          <EmptyState
            title="프로필이 없습니다"
            hint="상단의 + 버튼으로 SSH / WSL 프로필을 추가하세요."
          />
        ) : (
          profiles.map(profile => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              onOpen={() => onConnect(profile)}
              onContextMenu={e => handleContextMenu(e, profile)}
            />
          ))
        )}
      </div>

      {/* DB 섹션 */}
      <SectionHeader title="데이터베이스" count={dbProfiles.length} onAdd={onCreateDbProfile} />

      <div className="overflow-y-auto py-1.5 max-h-[38%] border-t border-white/[0.03]">
        {dbProfiles.length === 0 ? (
          <EmptyState
            title="DB 프로필이 없습니다"
            hint="MySQL 프로필을 추가하세요."
            small
          />
        ) : (
          dbProfiles.map(profile => (
            <DbProfileRow
              key={profile.id}
              profile={profile}
              onOpen={() => onOpenDb(profile)}
              onContextMenu={e => handleDbContextMenu(e, profile)}
            />
          ))
        )}
      </div>

      {/* 하단 설정 버튼 */}
      <div className="border-t border-white/5 p-2 shrink-0">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-[#bac2de] hover:text-[#cdd6f4] hover:bg-white/5 transition-colors group"
          title="설정 (Ctrl+,)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[#9399b2] group-hover:text-[#89b4fa] transition-colors">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M7 1v1.5M7 11.5V13M13 7h-1.5M2.5 7H1M11.24 2.76l-1.06 1.06M3.82 10.18l-1.06 1.06M11.24 11.24l-1.06-1.06M3.82 3.82L2.76 2.76"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
            />
          </svg>
          <span className="font-medium">설정</span>
          <span className="ml-auto ui-pill">Ctrl+,</span>
        </button>
      </div>

      {/* 컨텍스트 메뉴들 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          profile={profiles.find(p => p.id === contextMenu.profileId)!}
          onConnect={onConnect} onEdit={handleEdit} onDelete={handleDelete}
          onClose={closeContextMenu}
        />
      )}
      {dbContextMenu && (
        <DbContextMenu
          x={dbContextMenu.x} y={dbContextMenu.y}
          profile={dbProfiles.find(p => p.id === dbContextMenu.profileId)!}
          onOpen={onOpenDb} onEdit={handleDbEdit} onDelete={handleDbDelete}
          onClose={closeDbContextMenu}
        />
      )}
    </motion.div>
  );
}

/* ---------------------- Section Header ---------------------- */

function SectionHeader({
  title, count, onAdd,
}: { title: string; count: number; onAdd: () => void }) {
  return (
    <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-gradient-to-b from-transparent to-black/10">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-[#bac2de] tracking-[0.08em] uppercase">{title}</span>
        {count > 0 && (
          <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-white/[0.06] text-[#bac2de] font-mono tabular-nums">
            {count}
          </span>
        )}
      </div>
      <button
        onClick={onAdd}
        className="w-6 h-6 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 transition-colors"
        title="추가"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/* ---------------------- Profile Rows ---------------------- */

function ProfileRow({
  profile, onOpen, onContextMenu,
}: { profile: SshProfile; onOpen: () => void; onContextMenu: (e: React.MouseEvent) => void }) {
  return (
    <div
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className="group mx-2 my-0.5 px-2.5 py-2 rounded-lg flex items-center gap-2.5 cursor-pointer hover:bg-white/[0.04] transition-colors"
    >
      <ProfileIcon type={profile.type} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-[#cdd6f4] truncate font-medium">{profile.name}</div>
        <div className="text-[10px] text-[#9399b2] truncate font-mono">
          {profile.type === 'wsl'
            ? `WSL · ${profile.distro || 'default'}`
            : `${profile.username}@${profile.host}:${profile.port}`}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onOpen(); }}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#a6e3a1] hover:bg-white/5 transition-all"
        title="연결"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M2 1.5L8.5 5 2 8.5z" />
        </svg>
      </button>
    </div>
  );
}

function DbProfileRow({
  profile, onOpen, onContextMenu,
}: { profile: DbProfile; onOpen: () => void; onContextMenu: (e: React.MouseEvent) => void }) {
  return (
    <div
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      className="group mx-2 my-0.5 px-2.5 py-2 rounded-lg flex items-center gap-2.5 cursor-pointer hover:bg-white/[0.04] transition-colors"
    >
      {/* MySQL 돌고래 */}
      <div className="w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-br from-[#f38ba8]/15 to-[#cba6f7]/10 border border-[#f38ba8]/15 shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#f38ba8]">
          <path d="M1.5 7.5c1-2 3-3 5-2.5 1 .3 1.8 1 2.3 1.8.4.6 1 .9 1.7 1 .7.1 1.2-.3 1.5-.8"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M9.5 6c.5-.5 1.2-.7 1.8-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="4.2" cy="7" r="0.5" fill="currentColor" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-[#cdd6f4] truncate font-medium flex items-center gap-1.5">
          {profile.name}
          {profile.useSshTunnel && (
            <span className="px-1 py-0 text-[8px] rounded bg-[#89b4fa]/15 text-[#89b4fa] font-mono">SSH</span>
          )}
        </div>
        <div className="text-[10px] text-[#9399b2] truncate font-mono">
          {profile.username}@{profile.host}:{profile.port}
          {profile.database ? ` / ${profile.database}` : ''}
        </div>
      </div>
    </div>
  );
}

function ProfileIcon({ type }: { type: SshProfile['type'] }) {
  if (type === 'wsl') {
    return (
      <div className="w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-br from-[#fab387]/15 to-[#f9e2af]/10 border border-[#fab387]/15 shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#fab387]">
          <circle cx="7" cy="5" r="3.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.5 9C4.5 9 5.5 12 7 12S9.5 9 9.5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="5.8" cy="4.5" r="0.55" fill="currentColor" />
          <circle cx="8.2" cy="4.5" r="0.55" fill="currentColor" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-br from-[#89b4fa]/15 to-[#74c7ec]/10 border border-[#89b4fa]/15 shrink-0">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#89b4fa]">
        <rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 6.5l1.5 1.5L4 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ---------------------- Empty State ---------------------- */

function EmptyState({ title, hint, small }: { title: string; hint: string; small?: boolean }) {
  return (
    <div className={`px-4 text-center text-[#9399b2] ${small ? 'py-4' : 'py-10'}`}>
      <div className={`${small ? 'text-[11px]' : 'text-[12px]'} text-[#bac2de] font-medium`}>{title}</div>
      <div className="text-[10px] mt-1 leading-relaxed">{hint}</div>
    </div>
  );
}

/* ---------------------- Context Menus ---------------------- */

function ContextMenu({
  x, y, profile, onConnect, onEdit, onDelete, onClose,
}: {
  x: number; y: number; profile: SshProfile;
  onConnect: (p: SshProfile) => void; onEdit: (p: SshProfile) => void; onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <MenuOverlay x={x} y={y} onClose={onClose}>
      <MenuItem icon={<IconPlay />} onClick={() => { onConnect(profile); onClose(); }}>연결</MenuItem>
      <MenuItem icon={<IconPencil />} onClick={() => onEdit(profile)}>편집</MenuItem>
      <div className="h-px bg-white/5 my-1" />
      <MenuItem icon={<IconTrash />} onClick={() => onDelete(profile.id)} danger>삭제</MenuItem>
    </MenuOverlay>
  );
}

function DbContextMenu({
  x, y, profile, onOpen, onEdit, onDelete, onClose,
}: {
  x: number; y: number; profile: DbProfile;
  onOpen: (p: DbProfile) => void; onEdit: (p: DbProfile) => void; onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <MenuOverlay x={x} y={y} onClose={onClose}>
      <MenuItem icon={<IconPlay />} onClick={() => { onOpen(profile); onClose(); }}>열기</MenuItem>
      <MenuItem icon={<IconPencil />} onClick={() => onEdit(profile)}>편집</MenuItem>
      <div className="h-px bg-white/5 my-1" />
      <MenuItem icon={<IconTrash />} onClick={() => onDelete(profile.id)} danger>삭제</MenuItem>
    </MenuOverlay>
  );
}

function MenuOverlay({
  x, y, onClose, children,
}: { x: number; y: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -3 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.12 }}
        className="absolute bg-[#1e1e2e]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl py-1.5 min-w-[140px] z-50"
        style={{ left: x, top: y }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}

function MenuItem({
  children, onClick, danger, icon,
}: { children: React.ReactNode; onClick: () => void; danger?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2.5 transition-colors ${
        danger
          ? 'text-[#f38ba8] hover:bg-[#f38ba8]/10'
          : 'text-[#cdd6f4] hover:bg-white/5'
      }`}
    >
      <span className={danger ? 'text-[#f38ba8]' : 'text-[#9399b2]'}>{icon}</span>
      {children}
    </button>
  );
}

/* ---------------------- Menu Icons ---------------------- */

function IconPlay() {
  return <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1.5L8.5 5 2 8.5z" /></svg>;
}
function IconPencil() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M4.5 3V2h3v1M3 3l.5 8h5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default Sidebar;

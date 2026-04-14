import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface DbProfileDialogProps {
  editProfile: DbProfile | null;
  sshProfiles: SshProfile[];
  onSave: (input: DbProfileInput) => Promise<void>;
  onCancel: () => void;
}

function DbProfileDialog({ editProfile, sshProfiles, onSave, onCancel }: DbProfileDialogProps) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(3306);
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [useSshTunnel, setUseSshTunnel] = useState(false);
  const [sshProfileId, setSshProfileId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editProfile) {
      setName(editProfile.name);
      setHost(editProfile.host);
      setPort(editProfile.port);
      setUsername(editProfile.username);
      setDatabase(editProfile.database || '');
      setUseSshTunnel(editProfile.useSshTunnel);
      setSshProfileId(editProfile.sshProfileId || '');
      setPassword('');
    }
  }, [editProfile]);

  const sshOnlyProfiles = sshProfiles.filter(p => p.type !== 'wsl');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('이름을 입력하세요');
    if (!host.trim()) return setError('호스트를 입력하세요');
    if (!username.trim()) return setError('사용자명을 입력하세요');
    if (useSshTunnel && !sshProfileId) return setError('SSH 프로필을 선택하세요');

    setSaving(true);
    try {
      const input: DbProfileInput = {
        name: name.trim(),
        kind: 'mysql',
        host: host.trim(),
        port,
        username: username.trim(),
        database: database.trim() || undefined,
        useSshTunnel,
        sshProfileId: useSshTunnel ? sshProfileId : undefined,
      };
      if (password || !editProfile) {
        input.password = password;
      }
      await onSave(input);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="w-[460px] bg-gradient-to-b from-[#181825] to-[#11111b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5 bg-black/20">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#f38ba8]/15 text-[#f38ba8]">
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <ellipse cx="7" cy="3" rx="5" ry="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 3v8c0 .83 2.24 1.5 5 1.5s5-.67 5-1.5V3" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 7c0 .83 2.24 1.5 5 1.5S12 7.83 12 7" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-[13px] font-semibold text-[#cdd6f4]">
              {editProfile ? 'DB 프로필 편집' : '새 DB 프로필'}
            </h2>
            <p className="text-[10px] text-[#9399b2]">MySQL 연결 정보를 입력합니다</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 transition-colors"
            title="닫기 (Esc)"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <DbField label="이름" required>
            <input
              className="ui-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 로컬 MySQL"
              autoFocus
            />
          </DbField>

          <div className="grid grid-cols-[1fr_100px] gap-2.5">
            <DbField label="호스트" required>
              <input
                className="ui-input font-mono"
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="127.0.0.1"
              />
            </DbField>
            <DbField label="포트">
              <input
                type="number"
                className="ui-input font-mono tabular-nums"
                value={port}
                onChange={e => setPort(parseInt(e.target.value, 10) || 3306)}
              />
            </DbField>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <DbField label="사용자명" required>
              <input
                className="ui-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="root"
              />
            </DbField>
            <DbField
              label="비밀번호"
              hint={editProfile ? '(비워두면 기존 유지)' : undefined}
            >
              <input
                type="password"
                className="ui-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </DbField>
          </div>

          <DbField label="기본 DB" hint="(선택)">
            <input
              className="ui-input font-mono"
              value={database}
              onChange={e => setDatabase(e.target.value)}
              placeholder="mydb"
            />
          </DbField>

          {/* SSH 터널 영역 */}
          <div className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
            <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors">
              <input
                type="checkbox"
                checked={useSshTunnel}
                onChange={e => setUseSshTunnel(e.target.checked)}
                className="accent-[#f38ba8]"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-[#cdd6f4]">SSH 터널 경유</div>
                <div className="text-[10px] text-[#9399b2]">외부에 열려 있지 않은 원격 MySQL에 접속</div>
              </div>
              {useSshTunnel && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#a6e3a1] shadow-[0_0_4px_rgba(166,227,161,0.6)]" />
              )}
            </label>
            {useSshTunnel && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5">
                <DbField label="SSH 프로필" required>
                  <select
                    className="ui-input"
                    value={sshProfileId}
                    onChange={e => setSshProfileId(e.target.value)}
                  >
                    <option value="">선택…</option>
                    {sshOnlyProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.username}@{p.host})</option>
                    ))}
                  </select>
                </DbField>
                <div className="flex gap-2 text-[10px] text-[#f9e2af] bg-[#f9e2af]/5 border border-[#f9e2af]/10 rounded-md px-2.5 py-2">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <div>
                    위 <b>호스트/포트</b>는 SSH 서버에서 본 MySQL 주소입니다 (대개 <span className="font-mono">127.0.0.1:3306</span>)
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#f38ba8]/10 border border-[#f38ba8]/20 text-[11px] text-[#f38ba8]">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-[12px] rounded-md text-[#bac2de] hover:text-[#cdd6f4] hover:bg-white/5 transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-[12px] rounded-md bg-[#f38ba8] text-[#1e1e2e] hover:bg-[#eba0ac] disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm shadow-[#f38ba8]/30 transition-colors"
            >
              {saving && (
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                  <path d="M10.5 6a4.5 4.5 0 0 0-4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              {saving ? '저장 중' : (editProfile ? '저장' : '생성')}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
}

function DbField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">
        {label}
        {required && <span className="text-[#f38ba8] text-[10px]">*</span>}
        {hint && <span className="normal-case text-[9px] text-[#7f849c] font-normal tracking-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export default DbProfileDialog;

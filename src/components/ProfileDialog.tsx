import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ProfileDialogProps {
  /** 편집할 프로필. null이면 새로 만들기. */
  editProfile: SshProfile | null;
  onSave: (input: SshProfileInput) => void;
  onCancel: () => void;
}

function ProfileDialog({ editProfile, onSave, onCancel }: ProfileDialogProps) {
  const [profileType, setProfileType] = useState<'ssh' | 'wsl'>('ssh');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>('password');
  const [password, setPassword] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [distro, setDistro] = useState('');
  const [distros, setDistros] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editProfile) {
      setProfileType(editProfile.type || 'ssh');
      setName(editProfile.name);
      setHost(editProfile.host);
      setPort(editProfile.port);
      setUsername(editProfile.username);
      setAuthMethod(editProfile.authMethod);
      setPrivateKeyPath(editProfile.privateKeyPath || '');
      setDistro(editProfile.distro || '');
      setPassword('');
      setPassphrase('');
    }
  }, [editProfile]);

  // WSL 배포판 목록 로드
  useEffect(() => {
    if (profileType === 'wsl') {
      window.electronAPI.wsl.listDistros().then(list => {
        setDistros(list);
        if (list.length > 0 && !distro) setDistro(list[0]);
      });
    }
  }, [profileType]);

  const handleSelectKeyFile = async () => {
    const path = await window.electronAPI.profile.selectKeyFile();
    if (path) {
      setPrivateKeyPath(path);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('이름을 입력하세요'); return; }

    if (profileType === 'wsl') {
      if (!distro) { setError('WSL 배포판을 선택하세요'); return; }
      const input: SshProfileInput = {
        name: name.trim(),
        type: 'wsl',
        host: '',
        port: 0,
        username: '',
        authMethod: 'password',
        distro,
      };
      onSave(input);
      return;
    }

    if (!host.trim()) { setError('호스트를 입력하세요'); return; }
    if (port < 1 || port > 65535) { setError('포트 범위: 1-65535'); return; }
    if (!username.trim()) { setError('사용자 이름을 입력하세요'); return; }
    if (authMethod === 'password' && !password && !editProfile) {
      setError('비밀번호를 입력하세요');
      return;
    }
    if (authMethod === 'privateKey' && !privateKeyPath) {
      setError('개인키 파일을 선택하세요');
      return;
    }

    const input: SshProfileInput = {
      name: name.trim(),
      type: 'ssh',
      host: host.trim(),
      port,
      username: username.trim(),
      authMethod,
      ...(authMethod === 'privateKey' && { privateKeyPath }),
      ...(password && { password }),
      ...(passphrase && { passphrase }),
    };

    onSave(input);
  };

  // ESC로 닫기
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  const isSsh = profileType === 'ssh';
  const accent = isSsh ? '#3ddc97' : '#fab387';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-[460px] bg-gradient-to-b from-[#181825] to-[#11111b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5 bg-black/20">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            {isSsh ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1.5" y="3" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 6.5l1.5 1.5L4 9.5M7 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1.5" y="2" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 5.5l1.5 1.5L4 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-[13px] font-semibold text-[#cdd6f4]">
              {editProfile ? '프로필 편집' : '새 프로필'}
            </h2>
            <p className="text-[10px] text-[#9399b2]">
              {editProfile ? '기존 연결 설정을 수정합니다' : '새로운 터미널 연결을 추가합니다'}
            </p>
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

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {/* 연결 유형 선택 */}
          {!editProfile && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">연결 유형</label>
              <div className="flex gap-1 bg-black/30 rounded-lg p-1 border border-white/5">
                <TypeTab
                  active={profileType === 'ssh'}
                  onClick={() => setProfileType('ssh')}
                  color="#3ddc97"
                  icon={
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                      <rect x="1.5" y="3" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M4 6.5l1.5 1.5L4 9.5M7 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  label="SSH"
                />
                <TypeTab
                  active={profileType === 'wsl'}
                  onClick={() => setProfileType('wsl')}
                  color="#fab387"
                  icon={
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                      <rect x="1.5" y="2" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M4 5.5l1.5 1.5L4 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  label="WSL"
                />
              </div>
            </div>
          )}

          <Field label="이름" value={name} onChange={setName} placeholder={profileType === 'wsl' ? 'Ubuntu' : '개발 서버'} />

          {profileType === 'wsl' ? (
            /* WSL 전용 필드 */
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">배포판</label>
              {distros.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#f38ba8]/10 border border-[#f38ba8]/20 text-[11px] text-[#f38ba8]">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0">
                    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  설치된 WSL 배포판을 찾을 수 없습니다
                </div>
              ) : (
                <select
                  value={distro}
                  onChange={e => setDistro(e.target.value)}
                  className="w-full bg-[#0b0b14] text-[#cdd6f4] text-[12px] px-3 py-2 rounded-md border border-white/5 outline-none focus:border-[#fab387]/60 transition-colors"
                >
                  {distros.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            /* SSH 전용 필드 */
            <>
              <div className="grid grid-cols-[1fr_100px] gap-2.5">
                <Field label="호스트" value={host} onChange={setHost} placeholder="192.168.1.1" />
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">포트</label>
                  <input
                    type="number"
                    value={port}
                    onChange={e => setPort(parseInt(e.target.value, 10) || 22)}
                    min={1}
                    max={65535}
                    className="w-full bg-[#0b0b14] text-[#cdd6f4] text-[12px] px-3 py-2 rounded-md border border-white/5 outline-none focus:border-[#3ddc97]/60 font-mono tabular-nums transition-colors"
                  />
                </div>
              </div>
              <Field label="사용자 이름" value={username} onChange={setUsername} placeholder="root" />

              {/* 인증 방식 */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">인증 방식</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <AuthOption
                    active={authMethod === 'password'}
                    onClick={() => setAuthMethod('password')}
                    icon={
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="6" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M4 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                    }
                    label="비밀번호"
                  />
                  <AuthOption
                    active={authMethod === 'privateKey'}
                    onClick={() => setAuthMethod('privateKey')}
                    icon={
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <circle cx="4" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M6.5 7H13M10 7v2M12 7v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    }
                    label="개인키"
                  />
                </div>
              </div>

              {authMethod === 'password' ? (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">
                    비밀번호 {editProfile && <span className="normal-case text-[9px] text-[#7f849c] font-normal">(변경하려면 입력)</span>}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={editProfile ? '••••••••' : '비밀번호'}
                    className="w-full bg-[#0b0b14] text-[#cdd6f4] text-[12px] px-3 py-2 rounded-md border border-white/5 outline-none focus:border-[#3ddc97]/60 transition-colors"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">개인키 파일</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={privateKeyPath}
                        readOnly
                        placeholder="키 파일을 선택하세요"
                        className="flex-1 bg-[#0b0b14] text-[#cdd6f4] text-[11px] px-3 py-2 rounded-md border border-white/5 outline-none font-mono truncate"
                      />
                      <button
                        type="button"
                        onClick={handleSelectKeyFile}
                        className="px-3 py-2 bg-white/5 text-[#cdd6f4] text-[11px] rounded-md hover:bg-white/10 border border-white/5 transition-colors font-medium"
                      >
                        찾아보기
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">
                      패스프레이즈 <span className="normal-case text-[9px] text-[#7f849c] font-normal">(선택)</span>
                    </label>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={e => setPassphrase(e.target.value)}
                      placeholder="키에 패스프레이즈가 있는 경우"
                      className="w-full bg-[#0b0b14] text-[#cdd6f4] text-[12px] px-3 py-2 rounded-md border border-white/5 outline-none focus:border-[#3ddc97]/60 transition-colors"
                    />
                  </div>
                </>
              )}
            </>
          )}

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
              className="px-5 py-2 text-[12px] rounded-md text-[#1e1e2e] font-semibold transition-colors shadow-sm"
              style={{ backgroundColor: accent, boxShadow: `0 2px 8px ${accent}40` }}
            >
              {editProfile ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function TypeTab({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
        active ? 'shadow-inner' : 'text-[#9399b2] hover:text-[#bac2de]'
      }`}
      style={
        active
          ? { backgroundColor: `${color}15`, color, boxShadow: `inset 0 1px 2px ${color}30` }
          : undefined
      }
    >
      <span className={active ? '' : 'opacity-60'}>{icon}</span>
      {label}
    </button>
  );
}

function AuthOption({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 text-[11px] font-medium rounded-md border transition-colors ${
        active
          ? 'bg-[#3ddc97]/10 border-[#3ddc97]/30 text-[#3ddc97]'
          : 'bg-black/20 border-white/5 text-[#bac2de] hover:bg-white/5 hover:text-[#cdd6f4]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#9399b2] mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0b0b14] text-[#cdd6f4] text-[12px] px-3 py-2 rounded-md border border-white/5 outline-none focus:border-[#3ddc97]/60 transition-colors"
      />
    </div>
  );
}

export default ProfileDialog;

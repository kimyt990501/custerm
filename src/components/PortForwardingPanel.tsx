import { useState, useCallback } from 'react';
import { usePortForwarding } from '../hooks/usePortForwarding';

interface PortForwardingPanelProps {
  sshSessionId: string;
}

function PortForwardingPanel({ sshSessionId }: PortForwardingPanelProps) {
  const { tunnels, error, setError, createTunnel, closeTunnel } = usePortForwarding({ sshSessionId });

  const [formType, setFormType] = useState<ForwardingType>('local');
  const [localAddr, setLocalAddr] = useState('127.0.0.1');
  const [localPort, setLocalPort] = useState('');
  const [remoteAddr, setRemoteAddr] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const lp = parseInt(localPort, 10);
    if (!lp || lp < 1 || lp > 65535) {
      setError('유효한 로컬 포트를 입력하세요 (1-65535)');
      return;
    }

    if (formType !== 'dynamic') {
      const rp = parseInt(remotePort, 10);
      if (!rp || rp < 1 || rp > 65535) {
        setError('유효한 원격 포트를 입력하세요 (1-65535)');
        return;
      }
    }

    setCreating(true);
    await createTunnel({
      type: formType,
      localAddr,
      localPort: lp,
      remoteAddr: formType !== 'dynamic' ? remoteAddr : undefined,
      remotePort: formType !== 'dynamic' ? parseInt(remotePort, 10) : undefined,
    });
    setCreating(false);
    setLocalPort('');
    setRemotePort('');
  }, [formType, localAddr, localPort, remoteAddr, remotePort, createTunnel, setError]);

  const typeLabel = (type: ForwardingType): string => {
    switch (type) {
      case 'local': return 'L';
      case 'remote': return 'R';
      case 'dynamic': return 'D';
    }
  };

  const typeColor = (type: ForwardingType): string => {
    switch (type) {
      case 'local': return '#a6e3a1';
      case 'remote': return '#f9e2af';
      case 'dynamic': return '#89b4fa';
    }
  };

  const formatTunnel = (tunnel: PortForwardingTunnel): string => {
    const c = tunnel.config;
    switch (c.type) {
      case 'local':
        return `${c.localAddr}:${c.localPort} → ${c.remoteAddr}:${c.remotePort}`;
      case 'remote':
        return `${c.remoteAddr}:${c.remotePort} → ${c.localAddr}:${c.localPort}`;
      case 'dynamic':
        return `${c.localAddr}:${c.localPort} (SOCKS5)`;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#181825]/80 to-[#11111b]/70 backdrop-blur-xl border-l border-white/5 w-[300px] shrink-0 select-none">
      {/* 헤더 */}
      <div className="h-11 flex items-center gap-2.5 px-4 border-b border-white/5 bg-black/10">
        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[#89b4fa]/15 text-[#89b4fa]">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 2v10M11 2v10M3 4h8M3 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[#cdd6f4]">포트 포워딩</div>
          <div className="text-[10px] text-[#9399b2]">활성 터널 {tunnels.length}개</div>
        </div>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f38ba8]/10 border-b border-[#f38ba8]/10">
          <span className="text-[10px] text-[#f38ba8] flex-1 truncate">{error}</span>
          <button onClick={() => setError(null)} className="text-[#f38ba8]/60 hover:text-[#f38ba8] transition-colors">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* 터널 목록 */}
      <div className="flex-1 overflow-y-auto py-1">
        {tunnels.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">
            활성 터널 없음
          </div>
        ) : (
          tunnels.map(tunnel => (
            <div
              key={tunnel.tunnelId}
              className="flex items-center gap-2 mx-2 my-1 px-2.5 py-2 rounded-lg bg-[#0b0b14]/40 border border-white/5 hover:border-white/10 hover:bg-[#0b0b14]/60 group transition-all"
            >
              {/* 유형 배지 */}
              <span
                className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold shrink-0"
                style={{ backgroundColor: typeColor(tunnel.config.type) + '15', color: typeColor(tunnel.config.type) }}
              >
                {typeLabel(tunnel.config.type)}
              </span>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[#cdd6f4] truncate font-mono" title={formatTunnel(tunnel)}>
                  {formatTunnel(tunnel)}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#9399b2] mt-0.5">
                  <span className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: tunnel.status === 'active' ? '#a6e3a1' : '#f38ba8' }}
                    />
                    {tunnel.status === 'active' ? '활성' : tunnel.status === 'error' ? '오류' : '닫힘'}
                  </span>
                  {tunnel.connections > 0 && (
                    <span>{tunnel.connections}개 연결</span>
                  )}
                </div>
              </div>

              {/* 닫기 버튼 */}
              <button
                onClick={() => closeTunnel(tunnel.tunnelId)}
                className="w-5 h-5 flex items-center justify-center text-[#9399b2] hover:text-[#f38ba8] opacity-0 group-hover:opacity-100 shrink-0 transition-all"
                title="터널 닫기"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* 새 터널 생성 폼 */}
      <div className="border-t border-white/5 p-3 space-y-2.5">
        <div className="text-[10px] text-[#9399b2] font-medium uppercase tracking-wider">새 터널</div>

        {/* 유형 선택 — 세그먼트 버튼 */}
        <div className="flex rounded-lg bg-[#0b0b14]/50 p-0.5">
          {(['local', 'remote', 'dynamic'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFormType(type)}
              className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all ${
                formType === type
                  ? 'bg-[#313244] text-[#cdd6f4] shadow-sm'
                  : 'text-[#9399b2] hover:text-[#bac2de]'
              }`}
            >
              {type === 'local' ? 'Local' : type === 'remote' ? 'Remote' : 'Dynamic'}
            </button>
          ))}
        </div>

        {/* 로컬 포트 */}
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="주소"
            value={localAddr}
            onChange={e => setLocalAddr(e.target.value)}
            className="w-[85px] bg-[#0b0b14]/50 text-[#cdd6f4] text-[11px] px-2 py-1.5 rounded-lg border border-white/5 outline-none focus:border-[#89b4fa]/50 transition-colors font-mono"
          />
          <input
            type="number"
            placeholder="로컬 포트"
            value={localPort}
            onChange={e => setLocalPort(e.target.value)}
            className="flex-1 bg-[#0b0b14]/50 text-[#cdd6f4] text-[11px] px-2 py-1.5 rounded-lg border border-white/5 outline-none focus:border-[#89b4fa]/50 transition-colors font-mono"
          />
        </div>

        {/* 원격 주소/포트 (Dynamic 제외) */}
        {formType !== 'dynamic' && (
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="주소"
              value={remoteAddr}
              onChange={e => setRemoteAddr(e.target.value)}
              className="w-[85px] bg-[#0b0b14]/50 text-[#cdd6f4] text-[11px] px-2 py-1.5 rounded-lg border border-white/5 outline-none focus:border-[#89b4fa]/50 transition-colors font-mono"
            />
            <input
              type="number"
              placeholder="원격 포트"
              value={remotePort}
              onChange={e => setRemotePort(e.target.value)}
              className="flex-1 bg-[#0b0b14]/50 text-[#cdd6f4] text-[11px] px-2 py-1.5 rounded-lg border border-white/5 outline-none focus:border-[#89b4fa]/50 transition-colors font-mono"
            />
          </div>
        )}

        {/* 설명 */}
        <div className="text-[10px] text-[#9399b2] leading-relaxed">
          {formType === 'local' && '로컬 포트로 들어오는 연결을 원격 서버로 전달'}
          {formType === 'remote' && '원격 포트로 들어오는 연결을 로컬로 전달'}
          {formType === 'dynamic' && '로컬 SOCKS5 프록시를 통해 SSH 터널링'}
        </div>

        {/* 생성 버튼 */}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-1.5 text-[11px] font-medium rounded-lg bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#74c7ec] disabled:opacity-50 transition-colors shadow-sm shadow-[#89b4fa]/20"
        >
          {creating ? '생성 중...' : '터널 생성'}
        </button>
      </div>
    </div>
  );
}

export default PortForwardingPanel;

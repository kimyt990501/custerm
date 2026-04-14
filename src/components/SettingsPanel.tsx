import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import custermIcon from '../assets/custerm.png';

interface SettingsPanelProps {
  settings: AppSettings;
  themeNames: string[];
  onUpdate: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
}

type Tab = 'appearance' | 'terminal' | 'shortcuts' | 'about';

function SettingsPanel({ settings, themeNames, onUpdate, onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('appearance');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="w-[880px] h-[620px] rounded-2xl overflow-hidden flex shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/5 bg-[#11111b]"
        onClick={e => e.stopPropagation()}
      >
        {/* 좌측 내비 */}
        <div className="w-52 shrink-0 bg-gradient-to-b from-[#181825] to-[#11111b] border-r border-white/5 flex flex-col">
          <div className="h-14 flex items-center gap-2.5 px-5 border-b border-white/5">
            <img
              src={custermIcon}
              alt="Custerm"
              className="w-7 h-7 rounded-lg shadow-md shadow-[#3ddc97]/20"
              draggable={false}
            />
            <span className="text-sm font-semibold text-[#cdd6f4] tracking-wide">설정</span>
          </div>
          <nav className="flex-1 py-3 px-2 space-y-1">
            <TabItem icon={<IconPalette />} active={tab === 'appearance'} onClick={() => setTab('appearance')} label="모양" />
            <TabItem icon={<IconTerminal />} active={tab === 'terminal'} onClick={() => setTab('terminal')} label="터미널" />
            <TabItem icon={<IconKeyboard />} active={tab === 'shortcuts'} onClick={() => setTab('shortcuts')} label="단축키" />
            <TabItem icon={<IconInfo />} active={tab === 'about'} onClick={() => setTab('about')} label="정보" />
          </nav>
          <div className="px-5 py-3 border-t border-white/5 text-[10px] text-[#9399b2] leading-relaxed">
            <div className="text-[#bac2de] font-medium">Custerm</div>
            <div>v0.10 · Phase 10</div>
          </div>
        </div>

        {/* 우측 콘텐츠 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#181825]">
          <div className="h-14 flex items-center justify-between px-7 border-b border-white/5 shrink-0">
            <div>
              <div className="text-base font-semibold text-[#cdd6f4]">
                {tab === 'appearance' && '모양'}
                {tab === 'terminal' && '터미널'}
                {tab === 'shortcuts' && '단축키'}
                {tab === 'about' && '정보'}
              </div>
              <div className="text-[11px] text-[#9399b2] mt-0.5">
                {tab === 'appearance' && '테마, 투명도, 배경 블러'}
                {tab === 'terminal' && '폰트, 커서, 줄 간격'}
                {tab === 'shortcuts' && '키보드 단축키'}
                {tab === 'about' && '버전 및 기술 정보'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#9399b2] hover:text-[#cdd6f4] rounded-lg hover:bg-white/5 transition-colors"
              title="닫기 (Esc)"
            >
              <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-4 custom-scrollbar">
            {tab === 'appearance' && <AppearanceTab settings={settings} themeNames={themeNames} onUpdate={onUpdate} />}
            {tab === 'terminal' && <TerminalTab settings={settings} onUpdate={onUpdate} />}
            {tab === 'shortcuts' && <ShortcutsTab />}
            {tab === 'about' && <AboutTab />}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Tab items ---------------- */

function TabItem({
  active, onClick, label, icon,
}: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all ${
        active
          ? 'bg-gradient-to-r from-[#3ddc97]/15 to-transparent text-[#cdd6f4] shadow-inner ring-1 ring-[#3ddc97]/25'
          : 'text-[#bac2de] hover:text-[#cdd6f4] hover:bg-white/[0.03]'
      }`}
    >
      <span className={active ? 'text-[#3ddc97]' : 'text-[#9399b2]'}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

/* ---------------- Appearance ---------------- */

function AppearanceTab({
  settings, themeNames, onUpdate,
}: {
  settings: AppSettings;
  themeNames: string[];
  onUpdate: (p: Partial<AppSettings>) => void;
}) {
  return (
    <>
      <Card title="테마" subtitle="터미널 색상 팔레트를 선택합니다.">
        <div className="grid grid-cols-3 gap-2.5">
          {themeNames.map(name => {
            const selected = settings.themeName === name;
            return (
              <button
                key={name}
                onClick={() => onUpdate({ themeName: name })}
                className={`group relative px-3 py-2.5 rounded-lg border text-left transition-all ${
                  selected
                    ? 'border-[#3ddc97] bg-[#3ddc97]/10 shadow-[0_0_0_3px_rgba(61,220,151,0.08)]'
                    : 'border-white/5 bg-[#11111b] hover:border-white/15'
                }`}
              >
                <div className="text-[12px] font-medium text-[#cdd6f4] truncate">{name}</div>
                <ThemeSwatch name={name} />
                {selected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#3ddc97] flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3.5 6L7 2" stroke="#11111b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title="윈도우 투명도"
        subtitle="앱 창 전체의 불투명도를 조절합니다."
        right={<Pill>{Math.round(settings.opacity * 100)}%</Pill>}
      >
        <Slider
          min={0.3} max={1.0} step={0.05}
          value={settings.opacity}
          onChange={v => onUpdate({ opacity: v })}
          leftLabel="30%" rightLabel="100%"
        />
      </Card>

      <Card
        title="터미널 배경 투명도"
        subtitle="터미널 배경색만 반투명하게 만듭니다. 글자는 그대로 유지됩니다."
        right={<Pill>{Math.round(settings.terminalBackgroundOpacity * 100)}%</Pill>}
      >
        <Slider
          min={0.3} max={1.0} step={0.05}
          value={settings.terminalBackgroundOpacity}
          onChange={v => onUpdate({ terminalBackgroundOpacity: v })}
          leftLabel="30%" rightLabel="100% (불투명)"
        />
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            배경 블러 (Acrylic)
            <span className="px-1.5 py-0.5 text-[9px] rounded bg-[#74c7ec]/15 text-[#74c7ec] font-mono">Win11</span>
          </span>
        }
        subtitle="Windows 11 Acrylic 효과로 바탕화면을 자연스럽게 흐려 보여줍니다."
        right={<Pill>{settings.terminalBlur === 0 ? '꺼짐' : '켜짐'}</Pill>}
      >
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={settings.terminalBlur > 0}
            onChange={on => onUpdate({ terminalBlur: on ? 20 : 0 })}
          />
          <span className="text-[12px] text-[#bac2de]">
            {settings.terminalBlur > 0
              ? '바탕화면 배경이 블러 처리되어 보입니다.'
              : '끄면 불투명 그라디언트 배경이 사용됩니다.'}
          </span>
        </div>
        {settings.terminalBlur > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-[#f9e2af]/5 border border-[#f9e2af]/15 text-[11px] text-[#f9e2af]/80 leading-relaxed flex gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>
              Acrylic 효과가 보이려면 Windows 11 에서 <b>투명 효과</b>가 켜져 있어야 합니다.
              배경 투명도도 100% 미만으로 낮춰야 효과가 드러납니다.
            </span>
          </div>
        )}
      </Card>
    </>
  );
}

function ThemeSwatch({ name }: { name: string }) {
  // 테마별 대표 5색 미리보기. 내장 테마 이름에 맞춰 하드코딩.
  const palettes: Record<string, string[]> = {
    'Catppuccin Mocha': ['#1e1e2e', '#f38ba8', '#3ddc97', '#3ddc97', '#f5c2e7'],
    'One Dark':         ['#282c34', '#e06c75', '#98c379', '#61afef', '#c678dd'],
    'Dracula':          ['#282a36', '#ff5555', '#50fa7b', '#8be9fd', '#ff79c6'],
    'Solarized Dark':   ['#002b36', '#dc322f', '#859900', '#268bd2', '#d33682'],
    'Tokyo Night':      ['#1a1b26', '#f7768e', '#9ece6a', '#7aa2f7', '#bb9af7'],
    'Nord':             ['#2e3440', '#bf616a', '#a3be8c', '#81a1c1', '#b48ead'],
    'Gruvbox Dark':     ['#282828', '#cc241d', '#98971a', '#458588', '#b16286'],
  };
  const palette = palettes[name] || ['#1e1e2e', '#f38ba8', '#3ddc97', '#3ddc97', '#f5c2e7'];
  return (
    <div className="flex gap-1 mt-2">
      {palette.map((c, i) => (
        <div
          key={i}
          className="flex-1 h-2.5 rounded-[2px]"
          style={{ background: c, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }}
        />
      ))}
    </div>
  );
}

/* ---------------- Terminal ---------------- */

function TerminalTab({
  settings, onUpdate,
}: { settings: AppSettings; onUpdate: (p: Partial<AppSettings>) => void }) {
  return (
    <>
      <Card title="글꼴" subtitle="터미널에서 사용할 고정폭 글꼴을 선택합니다.">
        <select
          value={settings.fontFamily}
          onChange={e => onUpdate({ fontFamily: e.target.value })}
          className="w-full bg-[#11111b] text-[#cdd6f4] text-[13px] px-3 py-2.5 rounded-lg border border-white/5 outline-none focus:border-[#3ddc97]/60 transition-colors"
          style={{ fontFamily: settings.fontFamily }}
        >
          <option value="'CaskaydiaCove Nerd Font', 'Cascadia Code', monospace">CaskaydiaCove Nerd Font</option>
          <option value="'FiraCode Nerd Font', 'Fira Code', monospace">FiraCode Nerd Font</option>
          <option value="'JetBrainsMono Nerd Font', 'JetBrains Mono', monospace">JetBrainsMono Nerd Font</option>
          <option value="'Cascadia Code', 'Consolas', 'Courier New', monospace">Cascadia Code</option>
          <option value="'Consolas', 'Courier New', monospace">Consolas</option>
          <option value="'Fira Code', 'Consolas', monospace">Fira Code</option>
          <option value="'JetBrains Mono', 'Consolas', monospace">JetBrains Mono</option>
          <option value="'D2Coding', 'Consolas', monospace">D2Coding</option>
          <option value="'Source Code Pro', 'Consolas', monospace">Source Code Pro</option>
          <option value="'Courier New', monospace">Courier New</option>
        </select>
        <div
          className="mt-3 px-3 py-3 rounded-lg bg-[#11111b] border border-white/5 text-[#cdd6f4]"
          style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize, lineHeight: settings.lineHeight }}
        >
          <div className="text-[#3ddc97]">$ echo "hello, world!"</div>
          <div className="text-[#cdd6f4]">hello, world!</div>
          <div className="text-[#3ddc97]">→ abc 123 ABC — 가나다 あいう</div>
        </div>
      </Card>

      <Card title="폰트 크기" right={<Pill>{settings.fontSize}px</Pill>}>
        <Slider
          min={10} max={24} step={1}
          value={settings.fontSize}
          onChange={v => onUpdate({ fontSize: v })}
          leftLabel="10px" rightLabel="24px"
        />
      </Card>

      <Card title="줄 간격" right={<Pill>{settings.lineHeight.toFixed(1)}</Pill>}>
        <Slider
          min={1.0} max={2.0} step={0.1}
          value={settings.lineHeight}
          onChange={v => onUpdate({ lineHeight: v })}
          leftLabel="1.0" rightLabel="2.0"
        />
      </Card>

      <Card title="커서" subtitle="커서 모양과 깜빡임을 설정합니다.">
        <div className="grid grid-cols-3 gap-2">
          {(['block', 'underline', 'bar'] as const).map(style => {
            const selected = settings.cursorStyle === style;
            return (
              <button
                key={style}
                onClick={() => onUpdate({ cursorStyle: style })}
                className={`px-3 py-3 rounded-lg border transition-all flex flex-col items-center gap-1.5 ${
                  selected
                    ? 'border-[#3ddc97] bg-[#3ddc97]/10'
                    : 'border-white/5 bg-[#11111b] hover:border-white/15'
                }`}
              >
                <CursorPreview style={style} />
                <span className="text-[11px] text-[#cdd6f4]">
                  {style === 'block' ? '블록' : style === 'underline' ? '밑줄' : '바'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-[13px] text-[#cdd6f4]">커서 깜빡임</div>
            <div className="text-[11px] text-[#9399b2]">현재 위치를 강조하기 위해 주기적으로 깜빡입니다.</div>
          </div>
          <ToggleSwitch
            checked={settings.cursorBlink}
            onChange={v => onUpdate({ cursorBlink: v })}
          />
        </div>
      </Card>
    </>
  );
}

function CursorPreview({ style }: { style: 'block' | 'underline' | 'bar' }) {
  return (
    <div className="relative w-7 h-5 bg-[#0b0b14] rounded-sm flex items-end justify-start overflow-hidden">
      {style === 'block' && <div className="absolute inset-[3px] bg-[#cdd6f4]" />}
      {style === 'underline' && <div className="absolute left-[3px] right-[3px] bottom-[3px] h-[2px] bg-[#cdd6f4]" />}
      {style === 'bar' && <div className="absolute top-[3px] bottom-[3px] left-[3px] w-[2px] bg-[#cdd6f4]" />}
    </div>
  );
}

/* ---------------- Shortcuts ---------------- */

function ShortcutsTab() {
  const groups: { title: string; items: { keys: string[]; desc: string }[] }[] = [
    {
      title: '일반',
      items: [
        { keys: ['Ctrl', ','], desc: '설정 열기' },
        { keys: ['Ctrl', 'B'], desc: '사이드바 토글' },
        { keys: ['Ctrl', 'P'], desc: '명령 팔레트' },
        { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Zen 모드 토글' },
      ],
    },
    {
      title: '탭',
      items: [
        { keys: ['Ctrl', 'T'], desc: '새 탭' },
        { keys: ['Ctrl', 'W'], desc: '현재 탭 닫기' },
        { keys: ['Ctrl', 'Tab'], desc: '다음 탭' },
        { keys: ['Ctrl', 'Shift', 'Tab'], desc: '이전 탭' },
      ],
    },
    {
      title: 'SQL 에디터',
      items: [
        { keys: ['Ctrl', 'Enter'], desc: '현재 문 실행' },
        { keys: ['Ctrl', 'Shift', 'Enter'], desc: '전체 실행' },
      ],
    },
  ];

  return (
    <>
      {groups.map(g => (
        <Card key={g.title} title={g.title}>
          <div className="divide-y divide-white/5">
            {g.items.map(s => (
              <div key={s.keys.join('+')} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-[13px] text-[#cdd6f4]">{s.desc}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="px-2 py-1 bg-[#11111b] border border-white/10 rounded text-[#bac2de] font-mono text-[11px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

/* ---------------- About ---------------- */

function AboutTab() {
  return (
    <>
      <Card>
        <div className="flex items-center gap-4">
          <img
            src={custermIcon}
            alt="Custerm"
            className="w-16 h-16 rounded-2xl shadow-lg shadow-[#3ddc97]/25"
            draggable={false}
          />
          <div>
            <div className="text-lg font-semibold text-[#cdd6f4]">Custerm</div>
            <div className="text-[13px] text-[#bac2de]">Multi-tab SSH · WSL · MySQL 클라이언트</div>
            <div className="text-[11px] text-[#9399b2] mt-1">v0.10.0 — Phase 10</div>
          </div>
        </div>
      </Card>

      <Card title="스택">
        <div className="grid grid-cols-2 gap-2">
          <StackRow k="런타임" v="Electron 41" />
          <StackRow k="UI" v="React · TS · Tailwind" />
          <StackRow k="터미널" v="xterm.js" />
          <StackRow k="SQL 에디터" v="Monaco" />
          <StackRow k="DB" v="mysql2" />
          <StackRow k="자격증명" v="keytar (OS 키체인)" />
        </div>
      </Card>

      <Card title="개인정보">
        <p className="text-[12px] text-[#bac2de] leading-relaxed">
          모든 설정과 프로필은 로컬에만 저장됩니다.<br />
          비밀번호와 passphrase 는 OS 키체인 (Windows Credential Vault) 에 암호화되어 보관되며
          외부로 전송되지 않습니다.
        </p>
      </Card>
    </>
  );
}

function StackRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#11111b] border border-white/5">
      <span className="text-[11px] text-[#9399b2]">{k}</span>
      <span className="text-[12px] text-[#cdd6f4] font-mono">{v}</span>
    </div>
  );
}

/* ---------------- Primitives ---------------- */

function Card({
  title, subtitle, right, children,
}: {
  title?: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#11111b]/60 border border-white/5 p-4 hover:border-white/10 transition-colors">
      {(title || right) && (
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0">
            {title && <div className="text-[13px] font-semibold text-[#cdd6f4]">{title}</div>}
            {subtitle && <div className="text-[11px] text-[#9399b2] mt-0.5 leading-relaxed">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 px-2 py-0.5 rounded-md bg-[#313244] text-[#cdd6f4] text-[11px] font-mono tabular-nums">
      {children}
    </span>
  );
}

function Slider({
  min, max, step, value, onChange, leftLabel, rightLabel,
}: {
  min: number; max: number; step: number;
  value: number;
  onChange: (v: number) => void;
  leftLabel?: string; rightLabel?: string;
}) {
  return (
    <div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
        className="w-full accent-[#3ddc97] cursor-pointer"
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[10px] text-[#9399b2] mt-1.5">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  // 트랙 44px, 노브 16px, 좌우 여백 2px → on 시 이동거리 44 - 16 - 2 - 2 = 24px
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-[#3ddc97]' : 'bg-[#313244]'
      }`}
    >
      <span
        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

/* ---------------- Icons ---------------- */

function IconPalette() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1C3.7 1 1 3.7 1 7c0 3 2 5 4.5 5 1 0 1.5-.5 1.5-1.2 0-.4-.2-.7-.5-.9-.3-.3-.5-.6-.5-1 0-.6.5-1 1-1H9c1.7 0 3-1.3 3-3C12 3 9.8 1 7 1z"
        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="4" cy="6" r="0.8" fill="currentColor" />
      <circle cx="7" cy="4" r="0.8" fill="currentColor" />
      <circle cx="10" cy="6" r="0.8" fill="currentColor" />
    </svg>
  );
}
function IconTerminal() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2.5" width="12" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3.5 6l2 1.5-2 1.5M6.5 9.2h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconKeyboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3.5" width="12" height="7" rx="1.3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3 6h.01M5 6h.01M7 6h.01M9 6h.01M11 6h.01M4 8.5h6"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.1" />
      <path d="M7 6.2v3.6M7 4.2v.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default SettingsPanel;

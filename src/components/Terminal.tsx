import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';

/**
 * #RRGGBB 을 rgba(r,g,b,alpha) 문자열로 변환.
 * 투명 배경(터미널 블러) 적용 시 xterm 배경색을 투명하게 만들기 위함.
 */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface TerminalBaseProps {
  tabId: string;
  active: boolean;
  /** 현재 테마 */
  theme: TerminalTheme | null;
  /** 현재 설정 */
  settings: AppSettings;
}

interface LocalTerminalProps extends TerminalBaseProps {
  type: 'local';
  onPtySpawned?: (tabId: string, ptyId: string) => void;
  onExit?: (tabId: string) => void;
}

interface SshTerminalProps extends TerminalBaseProps {
  type: 'ssh';
  profileId: string;
  onSshConnected?: (tabId: string, sessionId: string) => void;
  onSshError?: (tabId: string, error: string) => void;
  onExit?: (tabId: string) => void;
}

interface WslTerminalProps extends TerminalBaseProps {
  type: 'wsl';
  distro: string;
  onPtySpawned?: (tabId: string, ptyId: string) => void;
  onExit?: (tabId: string) => void;
}

type TerminalProps = LocalTerminalProps | SshTerminalProps | WslTerminalProps;

function TerminalComponent(props: TerminalProps) {
  const { tabId, active, theme, settings } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // 초기화: xterm + PTY/SSH 연결
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const xtermTheme = theme ? {
      background: hexToRgba(theme.background, settings.terminalBackgroundOpacity),
      foreground: theme.foreground,
      cursor: theme.cursor,
      selectionBackground: theme.selectionBackground,
      black: theme.black,
      red: theme.red,
      green: theme.green,
      yellow: theme.yellow,
      blue: theme.blue,
      magenta: theme.magenta,
      cyan: theme.cyan,
      white: theme.white,
      brightBlack: theme.brightBlack,
      brightRed: theme.brightRed,
      brightGreen: theme.brightGreen,
      brightYellow: theme.brightYellow,
      brightBlue: theme.brightBlue,
      brightMagenta: theme.brightMagenta,
      brightCyan: theme.brightCyan,
      brightWhite: theme.brightWhite,
    } : undefined;

    const xterm = new XTerm({
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      lineHeight: settings.lineHeight,
      theme: xtermTheme,
      allowProposedApi: true,
      allowTransparency: settings.terminalBackgroundOpacity < 1.0,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(new WebLinksAddon());
    const unicode11 = new Unicode11Addon();
    xterm.loadAddon(unicode11);
    xterm.unicode.activeVersion = '11';

    // 앱 단축키는 xterm이 가로채지 않는다 (false 반환 시 xterm 이벤트 전파 무시 안함)
    xterm.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        if (e.key === 'F11') return false; // Zen Mode

        if (e.ctrlKey) {
          if (e.key === 't' || e.key === 'w' ||
              e.key.toLowerCase() === 'p' || // Command Palette
              (e.key >= '1' && e.key <= '9')) {
            return false;
          }

          // Ctrl+V: 클립보드 내용을 직접 처리 (이미지면 경로, 텍스트면 텍스트)
          if (e.key === 'v') {
            e.preventDefault();
            window.electronAPI.clipboard.paste().then(result => {
              const id = sessionIdRef.current;
              if (!id) return;
              let content = '';
              if (result.type === 'image' && result.path) {
                content = result.path;
              } else if (result.type === 'text' && result.text) {
                content = result.text;
              }
              if (!content) return;
              if (props.type === 'local' || props.type === 'wsl') {
                window.electronAPI.pty.write(id, content);
              } else {
                window.electronAPI.ssh.write(id, content);
              }
            });
            return false; // xterm 기본 paste 차단
          }
        }
      }
      return true;
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.open(container);
    fitAddon.fit();

    // 초기 마운트 시 active 탭이면 즉시 포커스
    if (active) {
      requestAnimationFrame(() => {
        fitAddon.fit();
        xterm.focus();
      });
    }

    const cleanups: (() => void)[] = [];

    if (props.type === 'local' || props.type === 'wsl') {
      const api = window.electronAPI.pty;
      const shell = props.type === 'wsl' ? `wsl.exe -d ${props.distro}` : undefined;

      api.spawn(shell).then(({ id }) => {
        sessionIdRef.current = id;
        if (props.type === 'local' || props.type === 'wsl') {
          props.onPtySpawned?.(tabId, id);
        }

        cleanups.push(api.onData((ptyId, data) => {
          if (ptyId === id) xterm.write(data);
        }));

        cleanups.push(api.onExit((ptyId) => {
          if (ptyId === id) {
            props.onExit?.(tabId);
          }
        }));

        api.startListening(id);
        xterm.onData((data) => api.write(id, data));
        api.resize(id, xterm.cols, xterm.rows);
      });

      const resizeDisposable = xterm.onResize(({ cols, rows }) => {
        if (sessionIdRef.current) api.resize(sessionIdRef.current, cols, rows);
      });
      cleanups.push(() => resizeDisposable.dispose());
    } else {
      const api = window.electronAPI.ssh;

      xterm.write('\x1b[33m연결 중...\x1b[0m\r\n');

      api.connect({ profileId: props.profileId }).then(({ sessionId }) => {
        sessionIdRef.current = sessionId;
        props.onSshConnected?.(tabId, sessionId);

        cleanups.push(api.onData((sid, data) => {
          if (sid === sessionId) xterm.write(data);
        }));
        cleanups.push(api.onExit((sid) => {
          if (sid === sessionId) {
            props.onExit?.(tabId);
          }
        }));
        cleanups.push(api.onError((sid, error) => {
          if (sid === sessionId) xterm.write(`\r\n\x1b[31m[SSH 오류: ${error}]\x1b[0m\r\n`);
        }));

        api.startListening(sessionId);
        xterm.onData((data) => api.write(sessionId, data));
        api.resize(sessionId, xterm.cols, xterm.rows);
      }).catch((err: Error) => {
        xterm.write(`\r\n\x1b[31m[SSH 연결 실패: ${err.message}]\x1b[0m\r\n`);
        props.onSshError?.(tabId, err.message);
      });

      const resizeDisposable = xterm.onResize(({ cols, rows }) => {
        if (sessionIdRef.current) api.resize(sessionIdRef.current, cols, rows);
      });
      cleanups.push(() => resizeDisposable.dispose());
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      cleanups.forEach(fn => fn());

      if (sessionIdRef.current) {
        if (props.type === 'local' || props.type === 'wsl') {
          window.electronAPI.pty.kill(sessionIdRef.current);
        } else {
          window.electronAPI.ssh.disconnect(sessionIdRef.current);
        }
      }
      xterm.dispose();
    };
  }, [tabId]);

  // 설정 변경 시 live update (xterm 인스턴스 재생성 없이)
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    xterm.options.fontSize = settings.fontSize;
    xterm.options.fontFamily = settings.fontFamily;
    xterm.options.lineHeight = settings.lineHeight;
    xterm.options.cursorStyle = settings.cursorStyle;
    xterm.options.cursorBlink = settings.cursorBlink;

    if (theme) {
      xterm.options.theme = {
        background: hexToRgba(theme.background, settings.terminalBackgroundOpacity),
        foreground: theme.foreground,
        cursor: theme.cursor,
        selectionBackground: theme.selectionBackground,
        black: theme.black,
        red: theme.red,
        green: theme.green,
        yellow: theme.yellow,
        blue: theme.blue,
        magenta: theme.magenta,
        cyan: theme.cyan,
        white: theme.white,
        brightBlack: theme.brightBlack,
        brightRed: theme.brightRed,
        brightGreen: theme.brightGreen,
        brightYellow: theme.brightYellow,
        brightBlue: theme.brightBlue,
        brightMagenta: theme.brightMagenta,
        brightCyan: theme.brightCyan,
        brightWhite: theme.brightWhite,
      };
    }

    // 폰트 크기 변경 후 fit 재계산
    fitAddonRef.current?.fit();
  }, [settings.fontSize, settings.fontFamily, settings.lineHeight,
      settings.cursorStyle, settings.cursorBlink, settings.terminalBackgroundOpacity, theme]);

  // 탭 전환 시 fit + 포커스
  useEffect(() => {
    if (active && fitAddonRef.current && xtermRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
      });
    }
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{
        visibility: active ? 'visible' : 'hidden',
        zIndex: active ? 1 : 0,
      }}
    />
  );
}

export default TerminalComponent;

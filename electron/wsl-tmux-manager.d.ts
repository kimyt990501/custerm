import type { TmuxListResult, TmuxWindow, TmuxPane } from './tmux-types';
/** WSL에서 tmux 세션 목록 조회 */
export declare function listWslTmuxSessions(distro: string): Promise<TmuxListResult>;
/** WSL에서 기존 tmux 세션에 attach (기존 PTY 스트림에 명령 입력) */
export declare function attachWslTmuxSession(ptyId: string, sessionName: string): void;
/** WSL에서 새 tmux 세션 생성 */
export declare function createWslTmuxSession(ptyId: string, sessionName?: string): void;
/** WSL에서 tmux 세션 분리 — Ctrl+b d */
export declare function detachWslTmux(ptyId: string): void;
export declare function sendWslTmuxKeys(ptyId: string, keys: string): void;
export declare function setWslTmuxMouse(ptyId: string, on: boolean): void;
export declare function listWslTmuxWindows(distro: string, sessionName: string): Promise<TmuxWindow[]>;
export declare function listWslTmuxPanes(distro: string, sessionName: string, windowIndex: number): Promise<TmuxPane[]>;
/** WSL에서 tmux 세션 종료 */
export declare function killWslTmuxSession(distro: string, sessionName: string): Promise<void>;

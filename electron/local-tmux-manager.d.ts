import type { TmuxListResult } from './tmux-types';
export declare function listLocalTmuxSessions(): Promise<TmuxListResult>;
export declare function attachLocalTmuxSession(ptyId: string, sessionName: string): void;
export declare function createLocalTmuxSession(ptyId: string, sessionName?: string): void;
export declare function detachLocalTmux(ptyId: string): void;
export declare function killLocalTmuxSession(sessionName: string): Promise<void>;

import * as pty from 'node-pty';
interface PtyInstance {
    process: pty.IPty;
    shell: string;
}
export declare function spawnPty(shell?: string): {
    id: string;
    shell: string;
};
export declare function getPty(id: string): PtyInstance | undefined;
export declare function writePty(id: string, data: string): void;
export declare function resizePty(id: string, cols: number, rows: number): void;
export declare function killPty(id: string): void;
export declare function killAllPtys(): void;
export {};

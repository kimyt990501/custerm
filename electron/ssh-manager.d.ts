import { Client, type ClientChannel } from 'ssh2';
import type { SshConnectParams } from './ssh-types';
interface SshSession {
    client: Client;
    stream: ClientChannel;
    profileId: string;
}
export declare function getSshSession(id: string): SshSession | undefined;
export declare function connectSsh(params: SshConnectParams): Promise<{
    sessionId: string;
}>;
export declare function writeSsh(id: string, data: string): void;
export declare function resizeSsh(id: string, cols: number, rows: number): void;
export declare function disconnectSsh(id: string): void;
export declare function disconnectAllSsh(): void;
export {};

import type { WebContents } from 'electron';
import type { SftpFileEntry } from './sftp-types';
export declare function openSftp(sshSessionId: string): Promise<{
    sftpId: string;
}>;
export declare function closeSftp(sftpId: string): void;
export declare function closeSftpForSession(sshSessionId: string): void;
export declare function closeAllSftp(): void;
export declare function sftpReaddir(sftpId: string, remotePath: string): Promise<SftpFileEntry[]>;
export declare function sftpMkdir(sftpId: string, remotePath: string): Promise<void>;
export declare function sftpDelete(sftpId: string, remotePath: string): Promise<void>;
export declare function sftpRmdir(sftpId: string, remotePath: string): Promise<void>;
export declare function sftpRename(sftpId: string, oldPath: string, newPath: string): Promise<void>;
export declare function sftpStat(sftpId: string, remotePath: string): Promise<SftpFileEntry>;
export declare function localReaddir(localPath: string): Promise<SftpFileEntry[]>;
export declare function localHomedir(): string;
export declare function startUpload(sftpId: string, localPath: string, remotePath: string, sender: WebContents): string;
export declare function startDownload(sftpId: string, remotePath: string, localPath: string, sender: WebContents): string;
export declare function cancelTransfer(transferId: string): void;

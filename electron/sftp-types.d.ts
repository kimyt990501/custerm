/** SFTP 파일/디렉토리 항목 */
export interface SftpFileEntry {
    filename: string;
    longname: string;
    isDirectory: boolean;
    isSymlink: boolean;
    size: number;
    modifyTime: number;
    permissions: number;
}
/** 전송 방향 */
export type TransferDirection = 'upload' | 'download';
/** 전송 상태 */
export type TransferStatus = 'queued' | 'active' | 'completed' | 'failed';
/** 파일 전송 항목 */
export interface TransferItem {
    transferId: string;
    direction: TransferDirection;
    localPath: string;
    remotePath: string;
    filename: string;
    totalBytes: number;
    transferredBytes: number;
    status: TransferStatus;
    error?: string;
}

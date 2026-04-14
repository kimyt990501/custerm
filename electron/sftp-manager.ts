import type { SFTPWrapper } from 'ssh2';
import type { WebContents } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Readable, Writable } from 'node:stream';
import { getSshSession } from './ssh-manager';
import type { SftpFileEntry } from './sftp-types';

interface SftpSession {
  sftp: SFTPWrapper;
  sshSessionId: string;
}

interface ActiveTransfer {
  transferId: string;
  readStream: Readable;
  writeStream: Writable;
  cancelled: boolean;
}

const sftpSessions = new Map<string, SftpSession>();
const activeTransfers = new Map<string, ActiveTransfer>();
let nextSftpId = 0;
let nextTransferId = 0;

/** 최대 동시 전송 수 */
const MAX_CONCURRENT = 3;

interface QueuedTransfer {
  sftpId: string;
  localPath: string;
  remotePath: string;
  direction: 'upload' | 'download';
  sender: WebContents;
  transferId: string;
}
const transferQueue: QueuedTransfer[] = [];
let runningCount = 0;

// --- SFTP 세션 관리 ---

export function openSftp(sshSessionId: string): Promise<{ sftpId: string }> {
  const sshSession = getSshSession(sshSessionId);
  if (!sshSession) {
    throw new Error(`SSH 세션을 찾을 수 없습니다: ${sshSessionId}`);
  }

  return new Promise((resolve, reject) => {
    sshSession.client.sftp((err, sftp) => {
      if (err) {
        reject(new Error(`SFTP 열기 실패: ${err.message}`));
        return;
      }
      const sftpId = String(++nextSftpId);
      sftpSessions.set(sftpId, { sftp, sshSessionId });
      resolve({ sftpId });
    });
  });
}

export function closeSftp(sftpId: string): void {
  const session = sftpSessions.get(sftpId);
  if (session) {
    session.sftp.end();
    sftpSessions.delete(sftpId);
  }
}

export function closeSftpForSession(sshSessionId: string): void {
  for (const [sftpId, session] of sftpSessions) {
    if (session.sshSessionId === sshSessionId) {
      session.sftp.end();
      sftpSessions.delete(sftpId);
    }
  }
  // 해당 세션의 활성 전송도 취소
  for (const [transferId, transfer] of activeTransfers) {
    transfer.cancelled = true;
    activeTransfers.delete(transferId);
  }
}

export function closeAllSftp(): void {
  for (const [, session] of sftpSessions) {
    session.sftp.end();
  }
  sftpSessions.clear();
  for (const [, transfer] of activeTransfers) {
    transfer.cancelled = true;
  }
  activeTransfers.clear();
  transferQueue.length = 0;
}

// --- 디렉토리 작업 ---

function getSftp(sftpId: string): SFTPWrapper {
  const session = sftpSessions.get(sftpId);
  if (!session) {
    throw new Error(`SFTP 세션을 찾을 수 없습니다: ${sftpId}`);
  }
  return session.sftp;
}

export function sftpReaddir(sftpId: string, remotePath: string): Promise<SftpFileEntry[]> {
  const sftp = getSftp(sftpId);

  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) {
        reject(new Error(`디렉토리 읽기 실패: ${err.message}`));
        return;
      }

      const entries: SftpFileEntry[] = list.map(item => ({
        filename: item.filename,
        longname: item.longname,
        isDirectory: (item.attrs.mode! & 0o40000) !== 0,
        isSymlink: (item.attrs.mode! & 0o120000) === 0o120000,
        size: item.attrs.size ?? 0,
        modifyTime: (item.attrs.mtime ?? 0) * 1000,
        permissions: item.attrs.mode! & 0o7777,
      }));

      // 디렉토리 먼저, 그 다음 파일명 순으로 정렬
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.filename.localeCompare(b.filename);
      });

      resolve(entries);
    });
  });
}

export function sftpMkdir(sftpId: string, remotePath: string): Promise<void> {
  const sftp = getSftp(sftpId);
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (err) => {
      if (err) {
        reject(new Error(`디렉토리 생성 실패: ${err.message}`));
        return;
      }
      resolve();
    });
  });
}

export function sftpDelete(sftpId: string, remotePath: string): Promise<void> {
  const sftp = getSftp(sftpId);
  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (err) => {
      if (err) {
        reject(new Error(`파일 삭제 실패: ${err.message}`));
        return;
      }
      resolve();
    });
  });
}

export function sftpRmdir(sftpId: string, remotePath: string): Promise<void> {
  const sftp = getSftp(sftpId);
  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (err) => {
      if (err) {
        reject(new Error(`디렉토리 삭제 실패: ${err.message}`));
        return;
      }
      resolve();
    });
  });
}

export function sftpRename(sftpId: string, oldPath: string, newPath: string): Promise<void> {
  const sftp = getSftp(sftpId);
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => {
      if (err) {
        reject(new Error(`이름 변경 실패: ${err.message}`));
        return;
      }
      resolve();
    });
  });
}

export function sftpStat(sftpId: string, remotePath: string): Promise<SftpFileEntry> {
  const sftp = getSftp(sftpId);
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) {
        reject(new Error(`파일 정보 조회 실패: ${err.message}`));
        return;
      }
      resolve({
        filename: path.posix.basename(remotePath),
        longname: '',
        isDirectory: (stats.mode! & 0o40000) !== 0,
        isSymlink: (stats.mode! & 0o120000) === 0o120000,
        size: stats.size ?? 0,
        modifyTime: (stats.mtime ?? 0) * 1000,
        permissions: stats.mode! & 0o7777,
      });
    });
  });
}

// --- 로컬 파일시스템 ---

export async function localReaddir(localPath: string): Promise<SftpFileEntry[]> {
  const dirents = await fs.promises.readdir(localPath, { withFileTypes: true });
  const entries: SftpFileEntry[] = [];

  for (const dirent of dirents) {
    try {
      const fullPath = path.join(localPath, dirent.name);
      const stats = await fs.promises.stat(fullPath);
      entries.push({
        filename: dirent.name,
        longname: '',
        isDirectory: dirent.isDirectory(),
        isSymlink: dirent.isSymbolicLink(),
        size: stats.size,
        modifyTime: stats.mtimeMs,
        permissions: stats.mode & 0o7777,
      });
    } catch {
      // 접근 불가 파일은 건너뜀
    }
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.filename.localeCompare(b.filename);
  });

  return entries;
}

export function localHomedir(): string {
  return os.homedir();
}

// --- 파일 전송 ---

function processQueue(): void {
  while (runningCount < MAX_CONCURRENT && transferQueue.length > 0) {
    const item = transferQueue.shift()!;
    runningCount++;
    if (item.direction === 'upload') {
      executeUpload(item.sftpId, item.localPath, item.remotePath, item.sender, item.transferId);
    } else {
      executeDownload(item.sftpId, item.remotePath, item.localPath, item.sender, item.transferId);
    }
  }
}

function onTransferDone(): void {
  runningCount--;
  processQueue();
}

export function startUpload(
  sftpId: string,
  localPath: string,
  remotePath: string,
  sender: WebContents,
): string {
  const transferId = String(++nextTransferId);

  transferQueue.push({ sftpId, localPath, remotePath, direction: 'upload', sender, transferId });
  processQueue();

  return transferId;
}

export function startDownload(
  sftpId: string,
  remotePath: string,
  localPath: string,
  sender: WebContents,
): string {
  const transferId = String(++nextTransferId);

  transferQueue.push({ sftpId, localPath, remotePath, direction: 'download', sender, transferId });
  processQueue();

  return transferId;
}

function executeUpload(
  sftpId: string,
  localPath: string,
  remotePath: string,
  sender: WebContents,
  transferId: string,
): void {
  let sftp: SFTPWrapper;
  try {
    sftp = getSftp(sftpId);
  } catch (err) {
    sendTransferError(sender, transferId, (err as Error).message);
    onTransferDone();
    return;
  }

  let totalBytes = 0;
  try {
    const stats = fs.statSync(localPath);
    totalBytes = stats.size;
  } catch (err) {
    sendTransferError(sender, transferId, `로컬 파일 읽기 실패: ${(err as Error).message}`);
    onTransferDone();
    return;
  }

  const readStream = fs.createReadStream(localPath);
  const writeStream = sftp.createWriteStream(remotePath);

  const transfer: ActiveTransfer = {
    transferId,
    readStream,
    writeStream,
    cancelled: false,
  };
  activeTransfers.set(transferId, transfer);

  let transferred = 0;
  let lastProgressTime = 0;

  readStream.on('data', (chunk: string | Buffer) => {
    if (transfer.cancelled) {
      readStream.destroy();
      writeStream.destroy();
      return;
    }
    transferred += chunk.length;
    const now = Date.now();
    if (now - lastProgressTime >= 100) {
      lastProgressTime = now;
      sendTransferProgress(sender, transferId, transferred, totalBytes);
    }
  });

  writeStream.on('close', () => {
    if (!transfer.cancelled) {
      sendTransferProgress(sender, transferId, totalBytes, totalBytes);
      sendTransferComplete(sender, transferId);
    }
    activeTransfers.delete(transferId);
    onTransferDone();
  });

  writeStream.on('error', (err: Error) => {
    if (!transfer.cancelled) {
      sendTransferError(sender, transferId, err.message);
    }
    activeTransfers.delete(transferId);
    onTransferDone();
  });

  readStream.on('error', (err: Error) => {
    if (!transfer.cancelled) {
      sendTransferError(sender, transferId, err.message);
    }
    writeStream.destroy();
    activeTransfers.delete(transferId);
    onTransferDone();
  });

  readStream.pipe(writeStream);
}

function executeDownload(
  sftpId: string,
  remotePath: string,
  localPath: string,
  sender: WebContents,
  transferId: string,
): void {
  let sftp: SFTPWrapper;
  try {
    sftp = getSftp(sftpId);
  } catch (err) {
    sendTransferError(sender, transferId, (err as Error).message);
    onTransferDone();
    return;
  }

  // 먼저 원격 파일 크기를 조회
  sftp.stat(remotePath, (statErr, stats) => {
    if (statErr) {
      sendTransferError(sender, transferId, `원격 파일 정보 조회 실패: ${statErr.message}`);
      onTransferDone();
      return;
    }

    const totalBytes = stats.size ?? 0;
    const readStream = sftp.createReadStream(remotePath);
    const writeStream = fs.createWriteStream(localPath);

    const transfer: ActiveTransfer = {
      transferId,
      readStream,
      writeStream,
      cancelled: false,
    };
    activeTransfers.set(transferId, transfer);

    let transferred = 0;
    let lastProgressTime = 0;

    readStream.on('data', (chunk: string | Buffer) => {
      if (transfer.cancelled) {
        readStream.destroy();
        writeStream.destroy();
        return;
      }
      transferred += chunk.length;
      const now = Date.now();
      if (now - lastProgressTime >= 100) {
        lastProgressTime = now;
        sendTransferProgress(sender, transferId, transferred, totalBytes);
      }
    });

    writeStream.on('close', () => {
      if (!transfer.cancelled) {
        sendTransferProgress(sender, transferId, totalBytes, totalBytes);
        sendTransferComplete(sender, transferId);
      }
      activeTransfers.delete(transferId);
      onTransferDone();
    });

    writeStream.on('error', (err: Error) => {
      if (!transfer.cancelled) {
        sendTransferError(sender, transferId, err.message);
      }
      readStream.destroy();
      activeTransfers.delete(transferId);
      onTransferDone();
    });

    readStream.on('error', (err: Error) => {
      if (!transfer.cancelled) {
        sendTransferError(sender, transferId, err.message);
      }
      writeStream.destroy();
      activeTransfers.delete(transferId);
      onTransferDone();
    });

    readStream.pipe(writeStream);
  });
}

export function cancelTransfer(transferId: string): void {
  const transfer = activeTransfers.get(transferId);
  if (transfer) {
    transfer.cancelled = true;
    transfer.readStream.destroy();
    transfer.writeStream.destroy();
    activeTransfers.delete(transferId);
  }
  // 큐에서도 제거
  const queueIdx = transferQueue.findIndex(t => t.transferId === transferId);
  if (queueIdx !== -1) {
    transferQueue.splice(queueIdx, 1);
  }
}

// --- IPC 전송 헬퍼 ---

function sendTransferProgress(sender: WebContents, transferId: string, transferred: number, total: number): void {
  if (!sender.isDestroyed()) {
    sender.send('sftp:transfer-progress', transferId, transferred, total);
  }
}

function sendTransferComplete(sender: WebContents, transferId: string): void {
  if (!sender.isDestroyed()) {
    sender.send('sftp:transfer-complete', transferId);
  }
}

function sendTransferError(sender: WebContents, transferId: string, error: string): void {
  if (!sender.isDestroyed()) {
    sender.send('sftp:transfer-error', transferId, error);
  }
}

import { execSync } from 'node:child_process';

/** 시스템에 설치된 WSL 배포판 목록을 반환한다. */
export function listWslDistros(): string[] {
  if (process.platform !== 'win32') return [];

  try {
    // wsl.exe -l -q 는 UTF-16LE로 출력한다
    const buf = execSync('wsl.exe -l -q', { encoding: 'buffer' });
    const output = buf.toString('utf16le');
    return output
      .split('\n')
      .map(line => line.replace(/\r/g, '').trim())
      .filter(line => line.length > 0 && !line.startsWith('Windows'));
  } catch {
    return [];
  }
}

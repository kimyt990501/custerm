import { clipboard } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CLIPBOARD_DIR = path.join(os.homedir(), '.custerm', 'clipboard');

/** 저장 디렉터리가 없으면 생성 */
function ensureDir(): void {
  if (!fs.existsSync(CLIPBOARD_DIR)) {
    fs.mkdirSync(CLIPBOARD_DIR, { recursive: true });
  }
}

/**
 * 클립보드 내용을 판별하여 처리한다.
 * - 이미지가 있으면: PNG로 저장하고 { type: 'image', path } 반환
 * - 텍스트만 있으면: { type: 'text', text } 반환
 * - 아무것도 없으면: { type: 'empty' } 반환
 */
export function pasteFromClipboard(): { type: 'image'; path: string } | { type: 'text'; text: string } | { type: 'empty' } {
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    ensureDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const filename = `screenshot_${timestamp}.png`;
    const filePath = path.join(CLIPBOARD_DIR, filename);
    fs.writeFileSync(filePath, image.toPNG());
    return { type: 'image', path: filePath };
  }

  const text = clipboard.readText();
  if (text) {
    return { type: 'text', text };
  }

  return { type: 'empty' };
}

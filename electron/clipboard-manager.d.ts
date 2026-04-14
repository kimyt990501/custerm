/**
 * 클립보드 내용을 판별하여 처리한다.
 * - 이미지가 있으면: PNG로 저장하고 { type: 'image', path } 반환
 * - 텍스트만 있으면: { type: 'text', text } 반환
 * - 아무것도 없으면: { type: 'empty' } 반환
 */
export declare function pasteFromClipboard(): {
    type: 'image';
    path: string;
} | {
    type: 'text';
    text: string;
} | {
    type: 'empty';
};

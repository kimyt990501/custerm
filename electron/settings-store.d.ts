/** 색상 테마 정의 */
export interface TerminalTheme {
    name: string;
    background: string;
    foreground: string;
    cursor: string;
    selectionBackground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
}
export interface AppSettings {
    /** 현재 선택된 테마 이름 */
    themeName: string;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    /** 윈도우 투명도 0.3 ~ 1.0 */
    opacity: number;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    /** 터미널 배경 투명도 0.3 ~ 1.0. 1.0이면 완전 불투명. */
    terminalBackgroundOpacity: number;
    /** 터미널 뒤 배경 블러 (px). 0이면 블러 없음. */
    terminalBlur: number;
}
/** 내장 테마 목록 */
export declare const BUILTIN_THEMES: TerminalTheme[];
export declare function getSettings(): AppSettings;
export declare function updateSettings(partial: Partial<AppSettings>): AppSettings;
export declare function getThemeByName(name: string): TerminalTheme;
export declare function getThemeNames(): string[];

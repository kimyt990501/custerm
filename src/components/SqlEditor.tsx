import { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: (sql: string) => void; // 현재 선택/문장
  onRunAll: () => void;
}

/**
 * Monaco 기반 SQL 에디터.
 * Ctrl+Enter: 선택 영역 또는 현재 ';' 구분 문장 실행
 * Ctrl+Shift+Enter: 전체 실행
 */
function SqlEditor({ value, onChange, onRun, onRunAll }: SqlEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!model) return;

      let sql = '';
      if (selection && !selection.isEmpty()) {
        sql = model.getValueInRange(selection);
      } else {
        // 현재 커서 위치의 문장(';' 기준)
        const pos = editor.getPosition();
        if (!pos) return;
        const full = model.getValue();
        const offset = model.getOffsetAt(pos);
        // 앞쪽: 이전 ';' 찾기
        let start = 0;
        for (let i = offset - 1; i >= 0; i--) {
          if (full[i] === ';') { start = i + 1; break; }
        }
        // 뒤쪽: 다음 ';' 찾기
        let end = full.length;
        for (let i = offset; i < full.length; i++) {
          if (full[i] === ';') { end = i; break; }
        }
        sql = full.slice(start, end);
      }
      sql = sql.trim();
      if (sql) onRun(sql);
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => onRunAll(),
    );

    // Catppuccin-like 테마
    monaco.editor.defineTheme('custerm-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'cba6f7', fontStyle: 'bold' },
        { token: 'string', foreground: 'a6e3a1' },
        { token: 'number', foreground: 'fab387' },
        { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#0b0b14',
        'editor.foreground': '#cdd6f4',
        'editorLineNumber.foreground': '#45475a',
        'editorLineNumber.activeForeground': '#a6adc8',
        'editor.selectionBackground': '#313244',
        'editor.lineHighlightBackground': '#181825',
        'editorCursor.foreground': '#f38ba8',
      },
    });
    monaco.editor.setTheme('custerm-dark');
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="sql"
      value={value}
      onChange={v => onChange(v || '')}
      onMount={handleMount}
      options={{
        fontSize: 13,
        fontFamily: 'Consolas, "Courier New", monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        renderLineHighlight: 'line',
        lineNumbersMinChars: 3,
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}

export default SqlEditor;

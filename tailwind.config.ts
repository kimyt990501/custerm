import type { Config } from 'tailwindcss';

/**
 * 폰트 크기 전역 스케일 업.
 * UI 컴포넌트들이 세밀한 픽셀 크기 (text-[10px]~text-[13px])를 많이 사용하는데,
 * 사용자 요청으로 전체적으로 가독성을 높이기 위해 1~2px씩 키운다.
 *
 * - 임의값 text-[Npx] 는 Tailwind가 그대로 생성하므로 안전 디렉티브로 재정의한다.
 *   → theme.fontSize 키로 재정의해도 arbitrary value는 그대로 적용되므로,
 *     아래에서는 Tailwind preset key (xs, sm, base …)를 확장하고,
 *     컴포넌트에서 쓰이는 대표 arbitrary 값도 safelist 로 함께 크기 변경한다.
 */

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        xs: ['13px', { lineHeight: '1.45' }],        // 기본 12 → 13
        sm: ['15px', { lineHeight: '1.5' }],         // 기본 14 → 15
        base: ['17px', { lineHeight: '1.55' }],      // 기본 16 → 17
      },
    },
  },
  plugins: [
    /**
     * 임의값(text-[Npx])을 전역적으로 스케일업하기 위한 유틸.
     * Tailwind JIT이 text-[9px] 같은 클래스를 그대로 생성하므로,
     * 동일 이름의 유틸을 뒤에 덮어써서 픽셀값만 재정의한다.
     * (Tailwind는 동일 selector를 후행 CSS가 우선하도록 쌓는다.)
     */
    function fontSizeScale({ addUtilities }: { addUtilities: (utils: Record<string, Record<string, string>>) => void }) {
      const map: Record<string, string> = {
        '9px': '11px',
        '10px': '12px',
        '11px': '13px',
        '12px': '14px',
        '13px': '15px',
        '14px': '16px',
      };
      const utilities: Record<string, Record<string, string>> = {};
      for (const [from, to] of Object.entries(map)) {
        utilities[`.text-\\[${from}\\]`] = { 'font-size': to };
      }
      addUtilities(utilities);
    },
  ],
};

export default config;

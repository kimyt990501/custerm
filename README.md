<p align="center">
  <img src="assets/custerm_hero.png" alt="Custerm" width="720" />
</p>

<p align="center">
  <b>멀티탭 SSH · WSL · MySQL 클라이언트</b><br/>
  <sub>Electron + React + TypeScript로 만든, 매일 쓰기 좋게 다듬은 로컬 우선 터미널</sub>
</p>

<p align="center">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-3ddc97" />
</p>

---

## 왜 Custerm?

기존 터미널들은 **SSH만** 되거나, **DB는 또 따로** 띄워야 하거나, **파일 전송은 다른 앱**에서 해야 했습니다.
Custerm은 하루 종일 서버 작업을 하는 사람을 위해 **자주 쓰는 도구들을 한 창에** 묶었습니다.

- **멀티탭** — SSH / WSL / MySQL을 탭으로 자유롭게 섞어 사용
- **안전한 자격증명** — 비밀번호·passphrase는 OS 키체인(keytar)에 암호화 저장, 외부 전송 없음
- **깔끔한 다크 테마** — Catppuccin 기반 + 민트 브랜드 액센트, 배경 블러(Acrylic) 지원
- **가볍고 로컬 우선** — 모든 설정·프로필은 로컬에만, 계정 가입·로그인 불필요

---

## 주요 기능

### SSH / WSL 터미널
- SSH 프로필 관리 (호스트, 포트, 비밀번호 / 개인키 + passphrase)
- WSL 배포판 자동 감지 & 프로필화
- xterm.js 기반의 안정적인 터미널 (True Color, Unicode 11, 웹 링크)
- 분할 없이도 **탭으로 충분히 빠른** 컨텍스트 스위칭

### SFTP 파일 관리자
- 현재 SSH 세션과 **연결된** 파일 브라우저
- 드래그 앤 드롭 업로드 / 다운로드
- 실시간 전송 진행률, 병렬 전송

### 포트 포워딩
- SSH 터널로 원격 포트를 로컬에 매핑 (로컬 → 원격)
- 프로필당 여러 터널, 상태 표시(연결/끊김)

### tmux 패널
- SSH / WSL 세션의 tmux 세션·윈도우를 **GUI로 탐색**
- attach / detach / kill을 버튼 한 번으로

### Docker 패널
- 원격 호스트의 컨테이너 목록·상태를 실시간 표시
- start / stop / logs를 즉시 실행

### MySQL DB 탭 (DataGrip 스타일)
- **프로필 기반 접속** (직접 연결 또는 **기존 SSH 프로필로 터널 경유**)
- 데이터베이스 → 테이블(뷰) → 컬럼 **트리 탐색**
- **Monaco SQL 에디터** — 하이라이트, 자동완성, `Ctrl+Enter`로 현재 문 실행
- **가상 스크롤 결과 그리드** — 10만 행도 부드럽게, 정렬 / CSV 복사 / NULL·BLOB 렌더
- 쿼리 **취소**(`KILL QUERY`), 실행 시간 / 영향받은 행 수 표시
- 테이블 더블클릭 → `SELECT * LIMIT 200` 자동 삽입·실행

### 그 외
- 명령어 팔레트 (`Ctrl+Shift+P`)
- 설정창에서 폰트·투명도·블러·테마 즉시 변경
- ESC·단축키 중심 UX

---

## 스크린샷

> 스크린샷은 곧 추가 예정입니다.

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| 런타임 | Electron 41 |
| UI | React 19 · TypeScript 5.8 · Tailwind CSS 3.4 |
| 애니메이션 | Framer Motion |
| 터미널 | xterm.js (+ fit · unicode11 · web-links) |
| SSH | ssh2 + node-pty |
| DB | mysql2 + Monaco Editor + TanStack Virtual/Table |
| 자격증명 | keytar (OS 키체인) |
| 번들러 / 패키징 | Vite + electron-builder |

---

## 시작하기

### 요구 사항
- Node.js 18 이상
- Windows 10/11 · macOS · Linux

### 개발 실행
```bash
git clone https://github.com/kimyt990501/custerm.git
cd custerm
npm install
npm run electron:dev
```

### 프로덕션 빌드
```bash
# Windows
npm run package

# macOS
npm run package:mac

# Linux
npm run package:linux
```
빌드 산출물은 `release/` 폴더에 생성됩니다.

---

## 개인정보 & 보안

- **모든 설정·프로필은 로컬에만 저장**됩니다 (electron-store).
- 비밀번호·passphrase·DB 패스워드는 OS 키체인(Windows Credential Vault / macOS Keychain / libsecret)에 암호화되어 저장되며, 앱은 이를 네트워크로 전송하지 않습니다.
- 외부 분석·트래킹 없음.

---

## 로드맵

- [ ] 스키마 기반 SQL 자동완성
- [ ] 쿼리 히스토리 영속화
- [ ] 결과 행 인라인 편집 (PK 기반 DDL 자동 생성)
- [ ] PostgreSQL · MongoDB 지원
- [ ] ER 다이어그램 / EXPLAIN 시각화
- [ ] 터미널 분할 (split pane)

---

## 기여

이슈 · PR 모두 환영합니다. 큰 변경은 먼저 이슈로 논의해주세요.

---

<p align="center">
  <img src="assets/custerm_logo.png" alt="Custerm" width="260" />
</p>

<p align="center">
  <sub>MIT License · Built with a lot of <code>Ctrl+Enter</code></sub>
</p>

/** SSH 서버 프로필 — electron-store에 저장되는 메타데이터.
 *  비밀번호와 패스프레이즈는 여기에 포함하지 않고 keytar(OS 키체인)에 저장한다. */
export interface SshProfile {
    id: string;
    name: string;
    /** 프로필 유형: ssh(기본) 또는 wsl */
    type?: 'ssh' | 'wsl';
    host: string;
    port: number;
    username: string;
    authMethod: 'password' | 'privateKey';
    /** authMethod === 'privateKey'일 때 개인키 파일 경로 */
    privateKeyPath?: string;
    /** type === 'wsl'일 때 배포판 이름 */
    distro?: string;
    createdAt: number;
    updatedAt: number;
}
/** 프로필 생성/수정 시 렌더러에서 보내는 데이터 */
export interface SshProfileInput {
    name: string;
    /** 프로필 유형: ssh(기본) 또는 wsl */
    type?: 'ssh' | 'wsl';
    host: string;
    port: number;
    username: string;
    authMethod: 'password' | 'privateKey';
    privateKeyPath?: string;
    /** 비밀번호 — keytar에 저장된다. electron-store에는 저장하지 않는다. */
    password?: string;
    /** 개인키 패스프레이즈 — keytar에 저장된다. */
    passphrase?: string;
    /** type === 'wsl'일 때 배포판 이름 */
    distro?: string;
}
/** SSH 접속 요청 파라미터 */
export interface SshConnectParams {
    profileId: string;
    /** 저장하지 않고 일회성으로 사용할 비밀번호 */
    password?: string;
    /** 저장하지 않고 일회성으로 사용할 패스프레이즈 */
    passphrase?: string;
}

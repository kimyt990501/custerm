/** Docker 컨테이너/이미지 관리용 공통 타입 및 파서 */
export type DockerContainerState = 'running' | 'exited' | 'paused' | 'created' | 'restarting' | 'dead';
export interface DockerContainer {
    id: string;
    name: string;
    image: string;
    status: string;
    state: DockerContainerState;
    ports: string;
    createdAt: string;
}
export interface DockerImage {
    id: string;
    repository: string;
    tag: string;
    size: string;
    createdSince: string;
}
export interface DockerListResult {
    dockerAvailable: boolean;
    containers: DockerContainer[];
    images: DockerImage[];
}
/** `docker ps -a --format '{{json .}}'` 결과 파싱 */
export declare function parseDockerPs(stdout: string): DockerContainer[];
/** `docker images --format '{{json .}}'` 결과 파싱 */
export declare function parseDockerImages(stdout: string): DockerImage[];
/** 컨테이너 id/name 유효성 검사 (셸 인젝션 방지) */
export declare function isValidContainerRef(ref: string): boolean;
/** 이미지 ref 유효성 검사 (repo:tag, sha, digest 허용) */
export declare function isValidImageRef(ref: string): boolean;

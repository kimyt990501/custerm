import { type DockerListResult } from './docker-types';
/** 원격 서버의 docker 컨테이너 + 이미지 목록 조회 */
export declare function listDocker(sshSessionId: string): Promise<DockerListResult>;
export declare function startContainer(sshSessionId: string, id: string): Promise<void>;
export declare function stopContainer(sshSessionId: string, id: string): Promise<void>;
export declare function restartContainer(sshSessionId: string, id: string): Promise<void>;
export declare function removeContainer(sshSessionId: string, id: string, force: boolean): Promise<void>;
export declare function removeImage(sshSessionId: string, id: string, force: boolean): Promise<void>;
export declare function pullImage(sshSessionId: string, ref: string): Promise<string>;
/** 기존 셸 스트림에 `docker exec -it` 주입 */
export declare function execIntoContainer(sshSessionId: string, name: string, shell: string): void;
/** 기존 셸 스트림에 `docker logs -f` 주입 */
export declare function logsContainer(sshSessionId: string, name: string): void;

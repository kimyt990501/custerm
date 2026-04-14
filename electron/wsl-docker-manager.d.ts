import { type DockerListResult } from './docker-types';
export declare function listWslDocker(distro: string): Promise<DockerListResult>;
export declare function startWslContainer(distro: string, id: string): Promise<void>;
export declare function stopWslContainer(distro: string, id: string): Promise<void>;
export declare function restartWslContainer(distro: string, id: string): Promise<void>;
export declare function removeWslContainer(distro: string, id: string, force: boolean): Promise<void>;
export declare function removeWslImage(distro: string, id: string, force: boolean): Promise<void>;
export declare function pullWslImage(distro: string, ref: string): Promise<string>;
/** 기존 PTY 스트림에 `docker exec -it` 주입 */
export declare function execIntoWslContainer(ptyId: string, name: string, shell: string): void;
/** 기존 PTY 스트림에 `docker logs -f` 주입 */
export declare function logsWslContainer(ptyId: string, name: string): void;

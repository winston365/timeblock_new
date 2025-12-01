/**
 * Audio Service
 *
 * @fileoverview 오디오 재생을 관리하는 싱글톤 서비스 모듈
 *
 * @role 애플리케이션 전반의 오디오 재생 관리
 * @responsibilities
 *   - 오디오 파일 재생 (public 폴더 기준 경로)
 *   - 중복 재생 방지 (이전 오디오 자동 중지)
 *   - 재생 에러 처리 및 로깅
 *
 * @dependencies 없음 (순수 브라우저 API 사용)
 */
/**
 * 오디오 재생을 관리하는 싱글톤 서비스 클래스
 */
class AudioService {
    /** 현재 재생 중인 오디오 엘리먼트 */
    private currentAudio: HTMLAudioElement | null = null;

    /**
     * 오디오 파일을 재생합니다.
     *
     * @param path - 오디오 파일 경로 (public 폴더 기준, 예: '/assets/audio/click.mp3')
     * @returns 재생 완료 시 resolve되는 Promise
     */
    public async play(path: string): Promise<void> {
        try {
            // 이전 오디오 중지
            this.stop();

            const encodedPath = encodeURI(path);
            const audio = new Audio(encodedPath);
            this.currentAudio = audio;

            // 재생 시작
            await audio.play();
        } catch (error) {
            console.error('[AudioService] Failed to play audio:', error);
            this.currentAudio = null;
        }
    }
    /**
     * 현재 재생 중인 오디오를 중지하고 초기화합니다.
     */
    public stop(): void {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }
}

export const audioService = new AudioService();

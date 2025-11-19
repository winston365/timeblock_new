/**
 * Audio Service
 *
 * @role 오디오 재생을 관리하는 싱글톤 서비스
 * @responsibility
 *   - 오디오 파일 재생
 *   - 중복 재생 방지 (이전 오디오 중지)
 *   - 에러 처리
 */
class AudioService {
    private currentAudio: HTMLAudioElement | null = null;

    /**
     * 오디오 재생
     * @param path 오디오 파일 경로 (public 폴더 기준)
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
     * 오디오 중지
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

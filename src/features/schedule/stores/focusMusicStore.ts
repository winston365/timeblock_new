import { create } from 'zustand';
import { toast } from 'react-hot-toast';

/** GitHub 음원 레포지토리 설정 */
const MUSIC_REPO = { owner: 'winston365', repo: 'music', branches: ['main', 'gh-pages'] } as const;

/** 음악 폴더 목록 */
export const MUSIC_FOLDERS = [
    { id: '잔잔6593', label: '잔잔 6593' },
    { id: '활기', label: '활기' },
    { id: '흥분', label: '흥분' },
] as const;

/** 음악 트랙 정보 */
export type MusicTrack = { name: string; url: string };

/** 루프 모드: 단일 트랙 또는 폴더 전체 */
export type LoopMode = 'track' | 'folder';

interface FocusMusicState {
    // State
    selectedMusicFolder: string;
    musicTracks: MusicTrack[];
    currentTrackIndex: number | null;
    isMusicLoading: boolean;
    isMusicPlaying: boolean;
    loopMode: LoopMode;
    musicVolume: number;

    // Actions
    setSelectedMusicFolder: (folderId: string, options?: { autoplay?: boolean; githubToken?: string }) => void;
    setMusicVolume: (volume: number) => void;
    handleTogglePlay: () => void;
    handleNextRandom: (avoidSame?: boolean) => void;
    handleLoopModeChange: (mode: LoopMode) => void;
    stopMusic: () => void;

    // Internal Actions (called by UI or effects)
    fetchMusicTracks: (githubToken?: string) => Promise<void>;
}

// Audio Instance (Module Level Singleton)
let audio: HTMLAudioElement | null = null;

export const useFocusMusicStore = create<FocusMusicState>((set, get) => ({
    selectedMusicFolder: MUSIC_FOLDERS[0].id,
    musicTracks: [],
    currentTrackIndex: null,
    isMusicLoading: false,
    isMusicPlaying: false,
    loopMode: 'folder',
    musicVolume: 0.6,

    setSelectedMusicFolder: (folderId, options) => {
        set({ selectedMusicFolder: folderId });
        // 폴더 변경 시 트랙 로드
        get().stopMusic();
        get().fetchMusicTracks(options?.githubToken).then(() => {
            if (options?.autoplay) {
                get().handleNextRandom(false);
            }
        });
    },

    setMusicVolume: (volume) => {
        set({ musicVolume: volume });
        if (audio) {
            audio.volume = volume;
        }
    },

    handleTogglePlay: () => {
        const { isMusicPlaying, musicTracks, currentTrackIndex, musicVolume, loopMode, handleNextRandom } = get();

        if (audio && isMusicPlaying) {
            audio.pause();
            set({ isMusicPlaying: false });
            return;
        }

        if (!musicTracks.length) {
            toast.error('재생할 트랙이 없습니다.');
            return;
        }

        if (audio && currentTrackIndex !== null) {
            audio.volume = musicVolume;
            audio.loop = loopMode === 'track';
            audio
                .play()
                .then(() => set({ isMusicPlaying: true }))
                .catch(() => toast.error('음악을 재생할 수 없습니다.'));
        } else {
            handleNextRandom(false);
        }
    },

    handleNextRandom: (avoidSame = true) => {
        const { musicTracks, currentTrackIndex, musicVolume, loopMode } = get();

        if (!musicTracks.length) {
            toast.error('재생할 트랙이 없습니다.');
            return;
        }

        let nextIndex = Math.floor(Math.random() * musicTracks.length);
        if (avoidSame && musicTracks.length > 1 && nextIndex === currentTrackIndex) {
            nextIndex = (nextIndex + 1) % musicTracks.length;
        }

        set({ currentTrackIndex: nextIndex });

        if (!audio) {
            audio = new Audio();
        }

        audio.src = musicTracks[nextIndex].url;
        audio.volume = musicVolume;
        audio.loop = loopMode === 'track';

        // 이벤트 핸들러 재설정
        audio.onended = () => {
            // 최신 상태를 가져오기 위해 get() 사용
            const currentLoopMode = get().loopMode;
            if (currentLoopMode === 'folder') {
                get().handleNextRandom();
            }
        };

        audio
            .play()
            .then(() => set({ isMusicPlaying: true }))
            .catch((err) => {
                console.error('[FocusMusicStore] 음악 재생 실패:', err);
                toast.error('음악을 재생할 수 없습니다.');
            });
    },

    handleLoopModeChange: (mode) => {
        set({ loopMode: mode });
        if (audio) {
            audio.loop = mode === 'track';
        }
    },

    stopMusic: () => {
        if (audio) {
            audio.pause();
            // audio.src = ''; // src를 비우면 다시 재생할 때 문제가 생길 수 있으므로 pause만 함
        }
        set({ isMusicPlaying: false });
        // currentTrackIndex는 유지할지 초기화할지 결정. 
        // 완전 정지라면 초기화가 맞지만, 일시정지 개념이라면 유지.
        // 여기서는 "정지" 버튼이 따로 없고 Play/Pause 토글이므로, 
        // stopMusic은 보통 폴더 변경이나 컴포넌트 언마운트 시 호출됨.
        // 하지만 "지속되게 해달라"는 요청이므로 언마운트 시에는 호출하지 않음.
        // 폴더 변경 시에는 호출됨.
    },

    fetchMusicTracks: async (githubToken) => {
        const { selectedMusicFolder } = get();
        if (!selectedMusicFolder) return;

        set({ isMusicLoading: true, musicTracks: [], currentTrackIndex: null });

        try {
            const folderEncoded = encodeURIComponent(selectedMusicFolder);
            const headers: Record<string, string> = {
                Accept: 'application/vnd.github+json',
            };
            if (githubToken) {
                headers.Authorization = `Bearer ${githubToken}`;
            }

            let tracks: MusicTrack[] = [];
            let lastStatus: number | null = null;

            for (const branch of MUSIC_REPO.branches) {
                const apiUrl = `https://api.github.com/repos/${MUSIC_REPO.owner}/${MUSIC_REPO.repo}/contents/${folderEncoded}?ref=${branch}`;
                const res = await fetch(apiUrl, { headers });
                lastStatus = res.status;
                if (!res.ok) continue;

                const data = await res.json();
                if (!Array.isArray(data)) continue;

                tracks = data
                    .filter((item: any) => item.type === 'file' && /\.mp3$/i.test(item.name))
                    .map((item: any) => {
                        const fileEncoded = encodeURIComponent(item.name);
                        const url = `https://cdn.jsdelivr.net/gh/${MUSIC_REPO.owner}/${MUSIC_REPO.repo}@${branch}/${folderEncoded}/${fileEncoded}`;
                        return {
                            name: item.name.replace(/\.mp3$/i, ''),
                            url,
                        };
                    });
                if (tracks.length > 0) break;
            }

            if (tracks.length === 0) {
                if (lastStatus === 404) {
                    toast.error('음원 폴더를 찾을 수 없습니다.');
                } else {
                    toast.error('선택한 폴더에 mp3 파일이 없습니다.');
                }
            }
            set({ musicTracks: tracks });
        } catch (error) {
            console.error('[FocusMusicStore] 음악 목록 로드 실패:', error);
            toast.error('음악 목록을 불러오는 데 실패했습니다.');
        } finally {
            set({ isMusicLoading: false });
        }
    },
}));

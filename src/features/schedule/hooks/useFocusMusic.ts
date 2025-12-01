/**
 * useFocusMusic - 포커스 모드 배경 음악 관리 훅
 *
 * @role 포커스 뷰에서 배경 음악 재생 관련 상태 및 로직 관리
 * @responsibilities
 *   - GitHub 음원 레포지토리에서 트랙 목록 로드
 *   - 음악 재생/일시정지/정지 제어
 *   - 트랙/폴더 루프 모드 관리
 *   - 볼륨 제어
 * @dependencies
 *   - GitHub API: 음원 목록 로드
 *   - jsDelivr CDN: 음원 스트리밍
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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

/**
 * useFocusMusic 훅 옵션
 */
interface UseFocusMusicOptions {
  /** GitHub API 토큰 (선택적, API 제한 우회용) */
  githubToken?: string;
}

/**
 * 포커스 모드 배경 음악 관리 훅
 *
 * @param options - 훅 옵션
 * @param options.githubToken - GitHub API 토큰 (선택적)
 * @returns 음악 상태 및 제어 함수들
 */
export function useFocusMusic(options: UseFocusMusicOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedMusicFolder, setSelectedMusicFolder] = useState<string>(MUSIC_FOLDERS[0].id);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isMusicLoading, setIsMusicLoading] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [loopMode, setLoopMode] = useState<LoopMode>('folder');
  const [musicVolume, setMusicVolume] = useState(0.6);

  const musicVolumeRef = useRef(musicVolume);
  const loopModeRef = useRef<LoopMode>(loopMode);

  /**
   * 음악 재생 정지
   */
  const stopMusic = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setIsMusicPlaying(false);
    setCurrentTrackIndex(null);
  }, []);

  /**
   * GitHub에서 음악 트랙 목록 로드
   */
  const fetchMusicTracks = useCallback(async () => {
    if (!selectedMusicFolder) return;
    setIsMusicLoading(true);
    setMusicTracks([]);
    setCurrentTrackIndex(null);
    try {
      const folderEncoded = encodeURIComponent(selectedMusicFolder);
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
      };
      if (options.githubToken) {
        headers.Authorization = `Bearer ${options.githubToken}`;
      }

      let tracks: MusicTrack[] = [];
      let lastStatus: number | null = null;

      for (const branch of MUSIC_REPO.branches) {
        const apiUrl = `https://api.github.com/repos/${MUSIC_REPO.owner}/${MUSIC_REPO.repo}/contents/${folderEncoded}?ref=${branch}`;
        const res = await fetch(apiUrl, { headers });
        lastStatus = res.status;
        if (!res.ok) {
          continue;
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
          continue;
        }
        tracks = data
          .filter((item) => item.type === 'file' && /\.mp3$/i.test(item.name))
          .map((item) => {
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
          toast.error('음원 폴더를 찾을 수 없습니다. (branch main/gh-pages 모두 실패)');
        } else {
          toast.error('선택한 폴더에 mp3 파일이 없거나 불러오지 못했습니다.');
        }
      }
      setMusicTracks(tracks);
    } catch (error) {
      console.error('[useFocusMusic] 음악 목록 로드 실패:', error);
      toast.error('음악 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsMusicLoading(false);
    }
  }, [selectedMusicFolder, options.githubToken]);

  /**
   * 다음 트랙 랜덤 재생
   *
   * @param avoidSame - 현재 트랙 회피 여부 (default: true)
   */
  const handleNextRandom = useCallback(
    (avoidSame = true) => {
      if (!musicTracks.length) {
        toast.error('재생할 트랙이 없습니다.');
        return;
      }
      let nextIndex = Math.floor(Math.random() * musicTracks.length);
      if (avoidSame && musicTracks.length > 1 && nextIndex === currentTrackIndex) {
        nextIndex = (nextIndex + 1) % musicTracks.length;
      }
      setCurrentTrackIndex(nextIndex);
      const audio = audioRef.current || new Audio();
      audioRef.current = audio;
      audio.src = musicTracks[nextIndex].url;
      audio.volume = musicVolumeRef.current;
      audio.loop = loopModeRef.current === 'track';
      audio.onended = () => {
        if (loopModeRef.current === 'folder') {
          handleNextRandom();
        }
      };
      audio
        .play()
        .then(() => setIsMusicPlaying(true))
        .catch((err) => {
          console.error('[useFocusMusic] 음악 재생 실패:', err);
          toast.error('음악을 재생할 수 없습니다.');
        });
    },
    [currentTrackIndex, musicTracks]
  );

  /**
   * 음악 재생/일시정지 토글
   */
  const handleTogglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isMusicPlaying) {
      audio.pause();
      setIsMusicPlaying(false);
      return;
    }
    if (!musicTracks.length) {
      toast.error('재생할 트랙이 없습니다.');
      return;
    }
    if (audio && currentTrackIndex !== null) {
      audio.volume = musicVolumeRef.current;
      audio.loop = loopModeRef.current === 'track';
      audio
        .play()
        .then(() => setIsMusicPlaying(true))
        .catch(() => toast.error('음악을 재생할 수 없습니다.'));
    } else {
      handleNextRandom(false);
    }
  }, [currentTrackIndex, handleNextRandom, isMusicPlaying, musicTracks.length]);

  /**
   * 루프 모드 변경
   *
   * @param mode - 새 루프 모드 ('track' | 'folder')
   */
  const handleLoopModeChange = useCallback((mode: LoopMode) => {
    setLoopMode(mode);
  }, []);

  // Sync loop mode ref
  useEffect(() => {
    loopModeRef.current = loopMode;
    if (audioRef.current) {
      audioRef.current.loop = loopMode === 'track';
      audioRef.current.onended = () => {
        if (loopModeRef.current === 'folder') {
          handleNextRandom();
        }
      };
    }
  }, [loopMode, handleNextRandom]);

  // Sync volume ref
  useEffect(() => {
    musicVolumeRef.current = musicVolume;
    if (audioRef.current) {
      audioRef.current.volume = musicVolume;
    }
  }, [musicVolume]);

  // Fetch tracks when folder changes
  useEffect(() => {
    stopMusic();
    fetchMusicTracks();
  }, [fetchMusicTracks, stopMusic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, [stopMusic]);

  return {
    // State
    selectedMusicFolder,
    musicTracks,
    currentTrackIndex,
    isMusicLoading,
    isMusicPlaying,
    loopMode,
    musicVolume,

    // Actions
    setSelectedMusicFolder,
    setMusicVolume,
    handleTogglePlay,
    handleNextRandom,
    handleLoopModeChange,
    stopMusic,
  };
}

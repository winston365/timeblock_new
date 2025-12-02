/**
 * @file FocusMusicPlayer.tsx
 * @role 포커스 뷰 배경 음악 플레이어 UI 컴포넌트
 * @responsibilities
 *   - 음악 폴더 선택 및 트랙 재생 제어
 *   - 볼륨 조절 및 반복 모드 설정
 *   - 현재 재생 상태 표시
 * @dependencies useFocusMusic 훅 (MUSIC_FOLDERS, LoopMode, MusicTrack)
 */

import { MUSIC_FOLDERS, type LoopMode, type MusicTrack } from '../hooks/useFocusMusic';

interface FocusMusicPlayerProps {
  selectedMusicFolder: string;
  musicTracks: MusicTrack[];
  currentTrackIndex: number | null;
  isMusicLoading: boolean;
  isMusicPlaying: boolean;
  loopMode: LoopMode;
  musicVolume: number;
  setSelectedMusicFolder: (folderId: string) => void;
  setMusicVolume: (volume: number) => void;
  handleTogglePlay: () => void;
  handleNextRandom: (avoidSame?: boolean) => void;
  handleLoopModeChange: (mode: LoopMode) => void;
}

/**
 * 포커스 뷰 배경 음악 플레이어 컴포넌트
 * @param props - 플레이어 프로퍼티
 * @param props.selectedMusicFolder - 선택된 음악 폴더 ID
 * @param props.musicTracks - 현재 폴더의 음악 트랙 목록
 * @param props.currentTrackIndex - 현재 재생 중인 트랙 인덱스 (null이면 재생 중 아님)
 * @param props.isMusicLoading - 음악 로딩 중 여부
 * @param props.isMusicPlaying - 음악 재생 중 여부
 * @param props.loopMode - 반복 모드 ('track' | 'folder')
 * @param props.musicVolume - 음악 볼륨 (0~1)
 * @param props.setSelectedMusicFolder - 폴더 변경 핸들러
 * @param props.setMusicVolume - 볼륨 변경 핸들러
 * @param props.handleTogglePlay - 재생/일시정지 토글 핸들러
 * @param props.handleNextRandom - 랜덤 다음 트랙 핸들러
 * @param props.handleLoopModeChange - 반복 모드 변경 핸들러
 * @returns 음악 플레이어 UI
 */
export function FocusMusicPlayer({
  selectedMusicFolder,
  musicTracks,
  currentTrackIndex,
  isMusicLoading,
  isMusicPlaying,
  loopMode,
  musicVolume,
  setSelectedMusicFolder,
  setMusicVolume,
  handleTogglePlay,
  handleNextRandom,
  handleLoopModeChange,
}: FocusMusicPlayerProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3 shadow-sm max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-[var(--color-text)]">배경 음악</span>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            폴더 선택 후 랜덤 재생 / 반복
          </span>
        </div>
        <select
          className="ml-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
          value={selectedMusicFolder}
          onChange={(e) => setSelectedMusicFolder(e.target.value)}
          disabled={isMusicLoading}
        >
          {MUSIC_FOLDERS.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={handleTogglePlay}
          className={`rounded-xl px-3 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 ${
            isMusicPlaying
              ? 'bg-emerald-500 text-white hover:opacity-90'
              : 'bg-[var(--color-primary)] text-white hover:opacity-90'
          }`}
          disabled={isMusicLoading || !musicTracks.length}
          aria-pressed={isMusicPlaying}
        >
          {isMusicPlaying ? '⏸︎ 일시정지 (재생 중)' : '▶️ 재생'}
        </button>
        <button
          onClick={() => handleNextRandom(true)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary-hover)] disabled:opacity-60"
          disabled={isMusicLoading || !musicTracks.length}
        >
          🔀 랜덤 다음
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoopModeChange('track')}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              loopMode === 'track'
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary-hover)]'
            }`}
            aria-pressed={loopMode === 'track'}
          >
            🔂 한 곡 반복
          </button>
          <button
            onClick={() => handleLoopModeChange('folder')}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              loopMode === 'folder'
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary-hover)]'
            }`}
            aria-pressed={loopMode === 'folder'}
          >
            🔁 폴더 반복
          </button>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2">
          <span className="text-xs text-[var(--color-text-tertiary)]">🔊 볼륨</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            className="h-2 w-32 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500"
            style={{
              accentColor: 'var(--color-primary)',
            }}
            aria-label="음악 볼륨"
          />
          <span className="w-10 text-right text-xs font-medium text-[var(--color-text-secondary)]">
            {Math.round(musicVolume * 100)}%
          </span>
        </div>
        <div className="ml-auto text-xs text-[var(--color-text-tertiary)]">
          {isMusicLoading && '불러오는 중...'}
          {!isMusicLoading && currentTrackIndex !== null && musicTracks[currentTrackIndex] && (
            <span>재생 중: {musicTracks[currentTrackIndex].name}</span>
          )}
          {!isMusicLoading && currentTrackIndex === null && musicTracks.length > 0 && (
            <span>{musicTracks.length}곡 준비됨</span>
          )}
        </div>
      </div>
    </div>
  );
}

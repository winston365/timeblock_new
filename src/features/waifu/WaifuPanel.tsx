/**
 * WaifuPanel
 *
 * @role 와이푸 캐릭터의 이미지, 대사, 호감도, 완료 작업 수, 기분을 표시하는 패널 컴포넌트
 * @input imagePath (string, optional) - 수동 이미지 경로 지정
 * @output 와이푸 이미지, 대사 말풍선, 호감도 바, 기분 표시, 완료 작업 수를 포함한 UI
 * @external_dependencies
 *   - useWaifuState: 와이푸 상태 훅
 *   - waifuImageUtils: 이미지 경로 및 호감도 관리 유틸리티
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useWaifu } from '@/features/waifu/hooks/useWaifu';
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { getWaifuImagePathWithFallback, getRandomImageNumber, getAffectionTier } from './waifuImageUtils';
import { getDialogueFromAffection, syncAffectionWithXP } from '@/data/repositories/waifuRepository';
import { addXP } from '@/data/repositories/gameStateRepository';
import { loadSettings } from '@/data/repositories/settingsRepository';
import { audioService } from '@/shared/services/media/audioService';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import type { WaifuMode } from '@/shared/types/domain';
import baseImage from './base.png';

interface WaifuPanelProps {
  imagePath?: string; // 수동 이미지 경로 (optional, 지정하지 않으면 호감도 기반 자동 선택)
}

/**
 * 와이푸 패널 컴포넌트
 * 호감도에 따라 자동으로 이미지가 변경되며, 클릭 시마다 또는 10분마다 같은 호감도 범위 내에서 랜덤 이미지로 변경됩니다.
 *
 * @param {WaifuPanelProps} props - imagePath를 포함하는 props
 * @returns {JSX.Element} 와이푸 패널 UI
 * @sideEffects
 *   - 10분마다 자동으로 이미지 변경
 *   - 매 클릭마다 이미지 및 대사 변경
 *   - 호감도 변경 시 이미지 자동 업데이트
 */
export default function WaifuPanel({ imagePath }: WaifuPanelProps) {
  const { waifuState, loading, currentMood, currentDialogue, currentAudio, refresh: refreshWaifu } = useWaifu();
  const { message: companionMessage, isPinned, togglePin, expressionOverride, show: showWaifu } = useWaifuCompanionStore();
  const [displayImagePath, setDisplayImagePath] = useState<string>('');

  // useRef로 변경하여 리렌더링 및 의존성 사이클 방지
  const currentImageIndexRef = useRef<number>(-1);

  const [waifuMode, setWaifuMode] = useState<WaifuMode>('characteristic');
  const lastImageChangeTime = useRef<number>(Date.now());

  // 설정 로드 (와이푸 모드)
  useEffect(() => {
    const loadWaifuMode = async () => {
      const settings = await loadSettings();
      setWaifuMode(settings.waifuMode);
    };
    loadWaifuMode();
  }, []);

  // 이미지 변경 함수
  const changeImage = useCallback(async (affection: number) => {
    if (!waifuState) return;

    // 일반 모드일 경우 base.png 사용
    if (waifuMode === 'normal') {
      setDisplayImagePath(baseImage);
      lastImageChangeTime.current = Date.now();
      return;
    }

    // 특성 모드일 경우 호감도에 따라 이미지 선택
    const tier = getAffectionTier(affection);

    // 이전 이미지와 다른 이미지를 선택하도록 현재 인덱스 전달 (Ref 사용)
    const newImageNumber = getRandomImageNumber(tier.name, currentImageIndexRef.current);

    // 이미지 경로 가져오기 (비동기 체크 포함)
    const path = await getWaifuImagePathWithFallback(affection, newImageNumber);

    setDisplayImagePath(path);
    currentImageIndexRef.current = newImageNumber; // Ref 업데이트
    lastImageChangeTime.current = Date.now();
  }, [waifuState, waifuMode]); // currentImageIndex 의존성 제거

  // 초기 이미지 로드 및 호감도 변경 시 이미지 업데이트
  useEffect(() => {
    if (expressionOverride?.imagePath) {
      setDisplayImagePath(expressionOverride.imagePath);
      lastImageChangeTime.current = Date.now();
      return;
    }

    if (imagePath) {
      setDisplayImagePath(imagePath);
    } else if (waifuState) {
      changeImage(waifuState.affection);
    }
  }, [expressionOverride?.imagePath, imagePath, waifuState?.affection, changeImage]);

  // 10분마다 자동으로 이미지 변경
  useEffect(() => {
    if (!waifuState) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastImageChangeTime.current;

      // 10분 (600,000ms) 경과 시 이미지 변경
      if (elapsed >= 600000) {
        changeImage(waifuState.affection);
      }
    }, 60000); // 1분마다 체크

    return () => clearInterval(interval);
  }, [waifuState, changeImage]);

  // 오디오 재생 (일반 대화용)
  useEffect(() => {
    if (currentAudio && !companionMessage) {
      audioService.play(currentAudio);
    }
  }, [currentAudio, companionMessage]);

  // 하트 파티클 효과
  const spawnHeartParticles = (x: number, y: number) => {
    confetti({
      particleCount: 15,
      spread: 60,
      origin: { x: x / window.innerWidth, y: y / window.innerHeight },
      colors: ['#ff69b4', '#ff1493', '#ffb6c1', '#ffc0cb'],
      disableForReducedMotion: true,
      zIndex: 1000,
    });
  };

  // 클릭 사운드 재생
  const playClickSound = () => {
    const soundId = Math.floor(Math.random() * 4) + 1;
    // 오디오 파일이 존재하는지 확인하기 어려우므로, 에러가 나도 무시하도록 try-catch 처리하거나
    // audioService 내부에서 처리되길 기대함.
    // 일단 경로 규칙에 따라 호출.
    audioService.play(`audio/click${soundId}.mp3`);
  };

  // 클릭 핸들러 - 매번 클릭마다 이미지 및 대사 변경 + 보상 지급 + 효과
  const handleClick = useCallback(async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (!waifuState) return;

    // 0. 시각/청각 효과
    // 마우스 이벤트인 경우 클릭 위치, 아니면 화면 중앙
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    if (e && 'clientX' in e) {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }

    spawnHeartParticles(x, y);
    playClickSound();

    // 1. 매번 클릭 시 이미지 변경
    changeImage(waifuState.affection);

    // 2. 매번 클릭 시 대사 변경
    const newDialogue = getDialogueFromAffection(waifuState.affection, waifuState.tasksCompletedToday);
    showWaifu(newDialogue.text);

    // 대사 오디오가 있다면 재생 (클릭 사운드와 겹칠 수 있음, 클릭 사운드는 짧은 효과음이라 괜찮음)
    if (newDialogue.audio) {
      audioService.play(newDialogue.audio);
    }

    // 3. XP 증가 (+1) - 사용자 요청으로 변경
    try {
      await addXP(1, undefined, 'other'); // reason 'other' for generic interaction
      // GameState UI 즉시 업데이트
      useGameStateStore.getState().refresh();
    } catch (error) {
      console.error('Failed to add XP:', error);
    }

    // 4. 호감도 동기화 (XP 기반) - 사용자 요청으로 변경
    try {
      await syncAffectionWithXP();
      // Waifu UI 즉시 업데이트
      refreshWaifu();
    } catch (error) {
      console.error('Failed to sync affection:', error);
    }

  }, [waifuState, changeImage, showWaifu, refreshWaifu]);

  if (loading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
        로딩 중...
      </div>
    );
  }

  if (!waifuState) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-danger)]">
        와이푸 데이터를 불러올 수 없습니다
      </div>
    );
  }

  // 기분 설명 가져오기
  const getMoodDescription = (mood: string): string => {
    switch (mood) {
      case '🥰': return '애정 넘침';
      case '😊': return '호감';
      case '🙂': return '관심';
      case '😐': return '무관심';
      case '😠': return '경계';
      case '😡': return '적대';
      default: return '보통';
    }
  };

  return (
    <section className="relative flex h-full min-h-0 flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/90 p-4 shadow-[0_45px_80px_rgba(0,0,0,0.5)] backdrop-blur">
      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePin();
        }}
        className={`absolute -left-12 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl border-y border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-lg transition hover:bg-[var(--color-bg-tertiary)] ${isPinned ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'}`}
        title={isPinned ? '고정 해제' : '패널 고정'}
        aria-label={isPinned ? '패널 고정 해제' : '패널 고정'}
      >
        {isPinned ? '📌' : '📍'}
      </button>

      <div className="relative flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-[var(--color-bg-tertiary)]/80 to-[var(--color-bg-secondary)]/90 shadow-[0_35px_70px_rgba(0,0,0,0.45)]">
        <div
          className="group relative flex flex-1 cursor-pointer flex-col items-center justify-end overflow-hidden px-8 pt-10 pb-32 text-center"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label={`와이푸 이미지. 클릭 시 포즈 변경. 현재 호감도 ${waifuState.affection}%, 기분: ${currentMood}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          <div className="relative w-full">
            {displayImagePath ? (
              <img
                src={displayImagePath}
                alt={`와이푸 (호감도 ${waifuState.affection}%)`}
                className="mx-auto max-h-[520px] w-auto object-contain drop-shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
              />
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-center text-sm text-[var(--color-text-secondary)]">
                <span className="text-5xl opacity-70">📷</span>
                <div className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                  이미지를 추가하려면<br />
                  <span className="font-semibold text-[var(--color-text)]">/public/assets/waifu/poses/</span> 폴더에<br />
                  호감도별 이미지를 넣어주세요
                  <div className="text-[0.65rem] text-[var(--color-text-secondary)]">
                    hostile/, wary/, indifferent/, interested/, affectionate/, loving/<br />
                    각 폴더에 1.png, 2.png, 3.png...
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute left-1/2 bottom-32 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-white opacity-0 transition duration-200 group-hover:opacity-100">
            클릭해서 포즈 변경하기
          </div>

          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-x-6 bottom-6 rounded-2xl border border-white/10 bg-[var(--color-bg-secondary)]/90 px-5 py-4 text-left text-sm text-[var(--color-text)] shadow-[0_25px_60px_rgba(0,0,0,0.4)] backdrop-blur"
          >
            <p>{companionMessage || currentDialogue}</p>
          </div>
        </div>

        <div
          role="region"
          aria-label="와이푸 통계"
          className="flex flex-col gap-4 border-t border-white/10 bg-[var(--color-bg-secondary)]/80 px-6 py-5 text-[var(--color-text)]"
        >
          <header className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">
            기분
          </header>
          <div className="flex items-center gap-3 text-lg">
            <span className="text-3xl">{currentMood}</span>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {getMoodDescription(currentMood)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[0.85rem] text-[var(--color-text-tertiary)]">
            <span className="font-semibold text-[var(--color-primary)]">호감도 {waifuState.affection}%</span>
            <span className="flex-1">
              <div className="relative h-2 rounded-full bg-[var(--color-bg-tertiary)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-fuchsia-500"
                  style={{ width: `${waifuState.affection}%` }}
                >
                  <span className="pointer-events-none absolute -right-3 top-[-7px] inline-flex h-3 w-3 rounded-full bg-[var(--color-bg-secondary)] shadow-[0_4px_10px_rgba(0,0,0,0.4)]" />
                </div>
              </div>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

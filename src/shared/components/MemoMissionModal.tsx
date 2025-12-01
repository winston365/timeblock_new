/**
 * @file MemoMissionModal.tsx
 * 
 * @description
 * Role: 전역 메모 미션 모달 컴포넌트
 * 
 * Responsibilities:
 * - 1분 타이머와 함께 메모 작성 UI 제공
 * - 30자 이상 작성 시 20XP, 200자 이상 시 40XP 보상 지급
 * - 미션 진행 상황 시각화 (타이머, 글자 수, 조건 충족 여부)
 * 
 * Key Dependencies:
 * - memoMissionStore: 미션 상태 관리
 * - gameStateStore: XP 지급
 * - FocusTimer: 타이머 시각화 컴포넌트
 */

import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useMemoMissionStore } from '@/shared/stores/memoMissionStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import { FocusTimer } from '@/features/schedule/components/FocusTimer';

/**
 * 메모 미션 모달 컴포넌트
 * 
 * 사용자가 1분 동안 30자 이상 메모를 작성하면 XP 보상을 받을 수 있는 모달.
 * 200자 이상 작성 시 추가 보상 제공.
 * 
 * @returns 메모 미션 모달 React 엘리먼트, 또는 닫힌 상태면 null
 */
export function MemoMissionModal() {
    const {
        isOpen,
        task,
        initialMemoLength,
        memoMissionStartTime,
        memoMissionElapsed,
        memoMissionText,
        onUpdateTask,
        onAwardXP,
        closeMission,
        setMemoText,
        updateElapsed,
    } = useMemoMissionStore();
    
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    
    // Timer interval
    useEffect(() => {
        if (!isOpen || memoMissionStartTime === null) return;
        
        const interval = setInterval(() => {
            updateElapsed(Math.floor((Date.now() - memoMissionStartTime) / 1000));
        }, 1000);
        
        return () => clearInterval(interval);
    }, [isOpen, memoMissionStartTime, updateElapsed]);
    
    // Focus textarea on open
    useEffect(() => {
        if (!isOpen) return;
        requestAnimationFrame(() => textAreaRef.current?.focus());
    }, [isOpen]);
    
    if (!isOpen || !task) return null;
    
    // Computed values
    const memoMissionCharCount = memoMissionText.length;
    const memoMissionAddedCount = Math.max(0, memoMissionCharCount - initialMemoLength);
    const memoMissionTimeMet = memoMissionElapsed >= 60;
    const memoMissionTextMet = memoMissionAddedCount >= 30;
    const memoMissionReward = memoMissionAddedCount >= 200 ? 40 : 20;
    const memoMissionEligible = memoMissionTimeMet && memoMissionTextMet;
    const memoMissionProgress = Math.min((memoMissionElapsed / 60) * 100, 100);
    
    const formatElapsedTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const handleClose = () => {
        closeMission();
    };
    
    const handleComplete = async () => {
        if (!memoMissionEligible) return;
        const reward = memoMissionReward;
        
        try {
            await onUpdateTask?.({ memo: memoMissionText });
        } catch (error) {
            console.error('[MemoMissionModal] 메모 저장에 실패했습니다:', error);
        }
        
        try {
            if (onAwardXP) {
                await onAwardXP(reward, 'memo_mission');
            } else {
                await useGameStateStore.getState().addXP(reward, task.timeBlock || undefined);
            }
            toast.success(`+${reward} XP 획득!`, { icon: '🎉' });
        } catch (error) {
            console.error('[MemoMissionModal] XP 지급 실패:', error);
            toast.error('XP 지급에 실패했어요. 다시 시도해주세요.');
        } finally {
            handleClose();
        }
    };
    
    return (
        <div
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="grid gap-0 md:grid-cols-[320px_1fr]">
                    <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-indigo-900/60 via-indigo-800/40 to-slate-900/40 p-6 text-white">
                        <FocusTimer
                            progress={memoMissionProgress}
                            size={220}
                            strokeWidth={12}
                            isRunning
                            color={memoMissionEligible ? '#22c55e' : '#a855f7'}
                        >
                            <div className="text-center">
                                <p className="text-xs text-white/70">경과 시간</p>
                                <p className="text-4xl font-bold leading-tight">{formatElapsedTime(memoMissionElapsed)}</p>
                                <p className="text-sm text-white/60">목표 01:00</p>
                            </div>
                        </FocusTimer>
                        
                        <div className="w-full space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
                            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span>{memoMissionTimeMet ? '✅' : '⏱️'}</span>
                                    <span>1분 경과</span>
                                </div>
                                <span className={memoMissionTimeMet ? 'text-emerald-200 font-semibold' : 'text-white/70'}>
                                    {formatElapsedTime(memoMissionElapsed)} / 01:00
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span>{memoMissionTextMet ? '✅' : '✍️'}</span>
                                    <span>추가 30자 이상</span>
                                </div>
                                <span className={memoMissionTextMet ? 'text-emerald-200 font-semibold' : 'text-white/70'}>
                                    +{memoMissionAddedCount}자
                                </span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <span>🏅</span>
                                    <span>예상 보상</span>
                                </div>
                                <span className={memoMissionReward === 40 ? 'text-amber-200 font-semibold' : 'text-indigo-100 font-semibold'}>
                                    +{memoMissionReward} XP
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-4 p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-tertiary)]">20XP Chance</p>
                                <h3 className="text-xl font-bold text-[var(--color-text)]">1분 메모 챌린지</h3>
                                <p className="text-sm text-[var(--color-text-tertiary)]">1분 이상, 추가 30자 이상 → 20XP / 추가 200자 이상 → 40XP</p>
                            </div>
                            <button
                                type="button"
                                className="rounded-full bg-[var(--color-bg-tertiary)] px-3 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                                onClick={handleClose}
                                aria-label="닫기"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <textarea
                            ref={textAreaRef}
                            className="h-48 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm leading-relaxed text-[var(--color-text)] shadow-inner transition-all focus:border-[var(--color-primary)] focus:bg-[var(--color-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            value={memoMissionText}
                            onChange={(e) => setMemoText(e.target.value)}
                            placeholder="오늘의 느낌, 깨달음, 작은 회고를 1분 동안 적어보세요."
                        />
                        
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--color-text-tertiary)]">
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2 py-1 font-semibold text-[var(--color-text)]">
                                    +{memoMissionAddedCount}자 (총 {memoMissionCharCount}자)
                                </span>
                                <span className={memoMissionTextMet ? 'text-emerald-400' : 'text-[var(--color-text-tertiary)]'}>
                                    {memoMissionTextMet ? '글자 조건 달성!' : '추가 30자 이상 작성하면 조건 충족'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`rounded-full px-2 py-1 font-semibold ${memoMissionEligible
                                        ? 'bg-emerald-500/20 text-emerald-200'
                                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                                        }`}
                                >
                                    {memoMissionEligible ? '조건 충족' : '조건 미충족'}
                                </span>
                                <span
                                    className={`rounded-full px-2 py-1 font-semibold ${memoMissionReward === 40
                                        ? 'bg-amber-500/20 text-amber-200'
                                        : 'bg-indigo-500/10 text-indigo-100'
                                        }`}
                                >
                                    예상 보상 +{memoMissionReward} XP
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]"
                                onClick={handleClose}
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                className={`rounded-xl px-5 py-2 text-sm font-bold shadow-md transition ${memoMissionEligible
                                    ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
                                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                                    }`}
                                disabled={!memoMissionEligible}
                                onClick={handleComplete}
                            >
                                완료 (+{memoMissionReward} XP)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

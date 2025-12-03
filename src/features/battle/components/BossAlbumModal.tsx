/**
 * @file BossAlbumModal.tsx
 * @description 보스 도감 모달 - 카드 컬렉션 앨범 스타일
 *
 * @role 오늘 처치한 보스 및 전체 보스 도감 표시
 * @responsibilities
 *   - 23마리 보스 대형 카드 그리드 표시
 *   - 처치한 보스: 컬러 이미지 + 이름 + 난이도
 *   - 미처치 보스: 회색 실루엣 + "???"
 *   - 스크롤 가능한 앨범 형태
 *   - 오늘 처치한 보스 하이라이트
 * @dependencies
 *   - BOSSES: 보스 데이터
 *   - useBattleStore: 배틀 상태 스토어
 */

import { useEffect, useMemo, useState } from 'react';
import { BOSSES } from '../data/bossData';
import { useBattleStore } from '../stores/battleStore';
import type { Boss, BossDifficulty } from '@/shared/types/domain';

interface BossAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 난이도 레이블 */
const DIFFICULTY_LABELS: Record<BossDifficulty, string> = {
  easy: '🌱 Easy',
  normal: '⚔️ Normal',
  hard: '🔥 Hard',
  epic: '💀 Epic',
};

/** 난이도 색상 */
const DIFFICULTY_COLORS: Record<BossDifficulty, { text: string; border: string; bg: string; glow: string }> = {
  easy: { text: 'text-green-400', border: 'border-green-500', bg: 'bg-green-500/10', glow: 'shadow-green-500/30' },
  normal: { text: 'text-blue-400', border: 'border-blue-500', bg: 'bg-blue-500/10', glow: 'shadow-blue-500/30' },
  hard: { text: 'text-orange-400', border: 'border-orange-500', bg: 'bg-orange-500/10', glow: 'shadow-orange-500/30' },
  epic: { text: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-500/10', glow: 'shadow-purple-500/30' },
};

/** 난이도 순서 */
const DIFFICULTY_ORDER: BossDifficulty[] = ['easy', 'normal', 'hard', 'epic'];

/**
 * 대형 보스 카드 컴포넌트 (앨범용) - 세로 직사각형
 */
interface BossCardProps {
  boss: Boss;
  isDefeatedToday: boolean;
  isDefeatedEver: boolean;
  onClick?: () => void;
}

function BossCard({ boss, isDefeatedToday, isDefeatedEver, onClick }: BossCardProps) {
  const imagePath = `/assets/bosses/${boss.image}`;
  const colors = DIFFICULTY_COLORS[boss.difficulty];

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col rounded-xl overflow-hidden transition-all duration-300
        ${isDefeatedEver 
          ? `border-2 ${colors.border}/60 hover:scale-[1.02] hover:shadow-xl ${colors.glow}` 
          : 'border-2 border-slate-700/50 bg-slate-800/30 opacity-60'
        }
        ${isDefeatedToday ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900' : ''}
      `}
    >
      {/* 보스 이미지 - 세로 직사각형 */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-b from-slate-800 to-slate-900">
        {isDefeatedEver ? (
          <>
            <img
              src={imagePath}
              alt={boss.name}
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />
            {/* 그라데이션 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800">
            <div className="text-center">
              <span className="text-6xl text-slate-700">?</span>
              <p className="text-xs text-slate-600 mt-2">미발견</p>
            </div>
          </div>
        )}

        {/* 난이도 뱃지 - 이미지 위에 표시 (항상 표시) */}
        <div className={`absolute top-2 left-2 z-10 ${colors.bg} ${colors.text} text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors.border}/50 backdrop-blur-sm`}>
          {boss.difficulty.toUpperCase()}
        </div>

        {/* 오늘 처치 뱃지 */}
        {isDefeatedToday && (
          <div className="absolute top-2 right-2 z-10 bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded-full shadow-lg animate-pulse">
            TODAY!
          </div>
        )}

        {/* 보스 정보 - 이미지 하단 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p
            className={`
              text-sm font-bold truncate
              ${isDefeatedToday 
                ? 'text-yellow-300' 
                : isDefeatedEver 
                  ? 'text-white' 
                  : 'text-slate-600'
              }
            `}
            title={isDefeatedEver ? boss.name : '???'}
          >
            {isDefeatedEver ? boss.name : '???'}
          </p>
        </div>
      </div>
    </button>
  );
}

/**
 * 보스 상세 오버레이
 */
interface BossDetailOverlayProps {
  boss: Boss;
  onClose: () => void;
}

function BossDetailOverlay({ boss, onClose }: BossDetailOverlayProps) {
  const imagePath = `/assets/bosses/${boss.image}`;
  const colors = DIFFICULTY_COLORS[boss.difficulty];

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="relative max-w-md w-full mx-4 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 카드 프레임 */}
        <div className={`relative rounded-2xl overflow-hidden border-4 ${colors.border} shadow-2xl ${colors.glow}`}>
          {/* 이미지 */}
          <div className="relative aspect-[3/4] overflow-hidden">
            <img
              src={imagePath}
              alt={boss.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: boss.imagePosition || 'center' }}
            />
            {/* 그라데이션 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition"
            >
              ✕
            </button>

            {/* 난이도 뱃지 */}
            <div className={`absolute top-3 left-3 ${colors.bg} ${colors.text} text-xs font-bold px-3 py-1 rounded-full border ${colors.border}`}>
              {DIFFICULTY_LABELS[boss.difficulty]}
            </div>
          </div>

          {/* 정보 영역 */}
          <div className="p-4 bg-slate-900">
            <h3 className="text-2xl font-black text-white mb-2">{boss.name}</h3>
            
            {/* 대사 */}
            {boss.defeatQuote && (
              <div className="bg-black/30 rounded-lg p-3 mt-3">
                <p className="text-xs text-gray-400 mb-1">처치 대사</p>
                <p className="text-sm text-gray-300 italic">"{boss.defeatQuote}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 보스 도감 모달 컴포넌트 - 앨범 스타일
 */
export default function BossAlbumModal({ isOpen, onClose }: BossAlbumModalProps) {
  const { dailyState, defeatedBossHistory } = useBattleStore();
  const [selectedBoss, setSelectedBoss] = useState<Boss | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'today'>('all');

  // 오늘 처치한 보스 ID 목록
  const todayDefeatedIds = useMemo(() => {
    return dailyState?.defeatedBossIds ?? [];
  }, [dailyState]);

  // 전체 처치 기록
  const allDefeatedIds = useMemo(() => {
    return new Set(defeatedBossHistory ?? []);
  }, [defeatedBossHistory]);

  // 전체 보스 목록 - 난이도 순 정렬 (easy → epic)
  const sortedBosses = useMemo(() => {
    return [...BOSSES].sort((a, b) => {
      return DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty);
    });
  }, []);

  // 오늘 처치한 보스 목록
  const todayDefeatedBosses = useMemo(() => {
    return BOSSES.filter(boss => todayDefeatedIds.includes(boss.id));
  }, [todayDefeatedIds]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedBoss) {
          setSelectedBoss(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, selectedBoss]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalBosses = BOSSES.length;
    const defeatedTotal = allDefeatedIds.size;
    const defeatedToday = todayDefeatedIds.length;
    const completionRate = Math.round((defeatedTotal / totalBosses) * 100);
    return { totalBosses, defeatedTotal, defeatedToday, completionRate };
  }, [allDefeatedIds, todayDefeatedIds]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center"
      onClick={onClose}
    >
      {/* 배경 */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/95 via-slate-900/98 to-black/95 backdrop-blur-lg" />

      {/* 메인 컨테이너 */}
      <div
        className="relative w-full max-w-5xl mx-4 max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🏆</span>
              <div>
                <h2 className="text-2xl font-black text-white">보스 도감</h2>
                <p className="text-sm text-slate-400">
                  {stats.defeatedTotal} / {stats.totalBosses} 발견 
                  <span className="ml-2 text-yellow-400">({stats.completionRate}%)</span>
                </p>
              </div>
            </div>

            {/* 진행 바 */}
            <div className="hidden sm:block w-40 h-3 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 뷰 모드 토글 */}
            {stats.defeatedToday > 0 && (
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === 'all' 
                      ? 'bg-slate-700 text-white' 
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setViewMode('today')}
                  className={`px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === 'today' 
                      ? 'bg-yellow-500 text-black' 
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  오늘 ({stats.defeatedToday})
                </button>
              </div>
            )}

            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xl transition"
              title="닫기 (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 오늘 뷰 */}
        {viewMode === 'today' && (
          <div className="flex-1 overflow-y-auto">
            {todayDefeatedBosses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <span className="text-6xl opacity-50 mb-4">🗡️</span>
                <p className="text-xl text-slate-400">오늘 처치한 보스가 없습니다</p>
                <p className="text-sm text-slate-500 mt-2">미션을 완료하여 보스를 처치하세요!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {todayDefeatedBosses.map((boss) => (
                  <BossCard
                    key={boss.id}
                    boss={boss}
                    isDefeatedToday={true}
                    isDefeatedEver={true}
                    onClick={() => setSelectedBoss(boss)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 전체 뷰 - 섹션 구분 없이 난이도순 정렬 */}
        {viewMode === 'all' && (
          <div className="flex-1 overflow-y-auto pr-2">
            {/* 보스 카드 그리드 - 큰 세로 직사각형 카드, 1행당 3개 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {sortedBosses.map((boss) => (
                <BossCard
                  key={boss.id}
                  boss={boss}
                  isDefeatedToday={todayDefeatedIds.includes(boss.id)}
                  isDefeatedEver={allDefeatedIds.has(boss.id)}
                  onClick={() => allDefeatedIds.has(boss.id) && setSelectedBoss(boss)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 하단 안내 */}
        <div className="shrink-0 mt-4 text-center">
          <p className="text-xs text-slate-600">
            💡 발견한 보스를 클릭하면 상세 정보를 볼 수 있습니다 • ESC로 닫기
          </p>
        </div>
      </div>

      {/* 보스 상세 오버레이 */}
      {selectedBoss && (
        <BossDetailOverlay 
          boss={selectedBoss} 
          onClose={() => setSelectedBoss(null)} 
        />
      )}
    </div>
  );
}

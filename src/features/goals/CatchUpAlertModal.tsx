/**
 * CatchUpAlertModal.tsx
 *
 * @file 앱 시작 시 만회 알림 모달
 * 
 * @deprecated 이 모달은 CatchUpAlertBanner로 대체되었습니다.
 *             모달이 갑자기 뜨는 것은 ADHD 사용자에게 방해가 될 수 있어,
 *             상단 배너 형태로 변경되었습니다.
 *             이 파일은 향후 제거될 수 있습니다.
 * 
 * @description
 *   - 뒤처진 장기목표들을 심각도별로 표시
 *   - 앱 시작 시 자동으로 표시 (뒤처진 목표가 있을 때만)
 *   - ADHD 친화적: 간결하고 행동 지향적 메시지
 * @hotkeys
 *   - ESC: 모달 닫기
 *   - Ctrl/Cmd+Enter: 모달 닫기 (단일 액션 버튼)
 */

import type { WeeklyGoal } from '@/shared/types/domain';
import type { CatchUpInfo } from './utils/catchUpUtils';
import { useModalHotkeys } from '@/shared/hooks';
import { useToastStore } from '@/shared/stores/toastStore';
import { getSystemState, setSystemState, SYSTEM_KEYS } from '@/data/repositories/systemRepository';
import { CATCH_UP_DEFAULTS, type CatchUpSnoozeState } from '@/shared/constants/defaults';

/** 오늘 날짜 문자열 반환 (YYYY-MM-DD) */
const getTodayString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

interface CatchUpAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  behindGoals: Array<{
    goal: WeeklyGoal;
    catchUpInfo: CatchUpInfo;
  }>;
}

/**
 * 앱 시작 시 만회 알림 모달
 */
export default function CatchUpAlertModal({
  isOpen,
  onClose,
  behindGoals,
}: CatchUpAlertModalProps) {
  const addToast = useToastStore((s) => s.addToast);

  useModalHotkeys({
    isOpen,
    onEscapeClose: onClose,
    primaryAction: {
      onPrimary: onClose,
    },
  });

  const handleView = (): void => {
    addToast('목표 목록으로 이동합니다.', 'info', 2000);
    onClose();
  };

  const handleSnooze = async (): Promise<void> => {
    const snoozeEndTime = new Date(
      Date.now() + CATCH_UP_DEFAULTS.DEFAULT_SNOOZE_MINUTES * 60 * 1000
    ).toISOString();

    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      snoozeUntil: snoozeEndTime,
      dismissedDate: null,
    } satisfies CatchUpSnoozeState);

    addToast(`⏰ ${CATCH_UP_DEFAULTS.DEFAULT_SNOOZE_MINUTES}분 후에 다시 알려드릴게요!`, 'info', 2500);
    onClose();
  };

  const handleDismissToday = async (): Promise<void> => {
    const existing = await getSystemState<CatchUpSnoozeState>(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE);

    await setSystemState(SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE, {
      ...existing,
      snoozeUntil: null,
      dismissedDate: getTodayString(),
    } satisfies CatchUpSnoozeState);

    addToast('오늘 하루 동안 표시하지 않을게요.', 'info', 2500);
    onClose();
  };

  // 뒤처진 목표가 없으면 렌더링하지 않음
  if (!isOpen || behindGoals.length === 0) {
    return null;
  }

  const dangerCount = behindGoals.filter(
    ({ catchUpInfo }) => catchUpInfo.severity === 'danger'
  ).length;

  // 전체 심각도 결정
  const overallSeverity = dangerCount > 0 ? 'danger' : 'warning';
  const headerEmoji = overallSeverity === 'danger' ? '🚨' : '⚡';
  const headerMessage =
    overallSeverity === 'danger'
      ? '집중이 필요해요!'
      : '조금만 더 힘내봐요!';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop - 클릭해도 닫히지 않음 (UX 통일) */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative mx-4 max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-2xl">
        {/* Header */}
        <div
          className={`px-6 py-4 ${
            overallSeverity === 'danger'
              ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20'
              : 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{headerEmoji}</span>
            <div>
              <h2 className="text-lg font-bold text-white">{headerMessage}</h2>
              <p className="text-sm text-white/60">
                {behindGoals.length}개 목표가 뒤처져 있어요
              </p>
            </div>
          </div>
        </div>

        {/* Goals List */}
        <div className="max-h-[50vh] overflow-y-auto p-4">
          <div className="space-y-3">
            {behindGoals.map(({ goal, catchUpInfo }) => (
              <div
                key={goal.id}
                className={`rounded-xl border p-4 ${catchUpInfo.config.borderClass} ${catchUpInfo.config.bgClass}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {catchUpInfo.config.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{goal.icon || '📚'}</span>
                      <h3 className="font-bold text-white truncate">
                        {goal.title}
                      </h3>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className={`text-lg font-bold ${catchUpInfo.config.textClass}`}>
                        {catchUpInfo.catchUpNeeded.toLocaleString()}
                      </span>
                      <span className="text-white/50 text-sm">
                        {goal.unit} 부족
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-white/40">
                      {catchUpInfo.config.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-6 py-4">
          <p className="mb-3 text-center text-xs text-white/40">
            작은 것부터 시작해봐요. 오늘 하나만 집중해도 괜찮아요! 💪
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleView}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 font-bold text-white transition-all hover:from-indigo-600 hover:to-purple-600 active:scale-[0.98]"
            >
              👀 목표 보기
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void handleSnooze()}
                className="rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/15 active:scale-[0.98]"
              >
                ⏰ 2시간 스누즈
              </button>
              <button
                onClick={() => void handleDismissToday()}
                className="rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/15 active:scale-[0.98]"
              >
                오늘은 닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

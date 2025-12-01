/**
 * InsightsTab
 *
 * @role AI 기반 생산성 인사이트 생성 및 표시 탭
 * @input InsightsTabProps (insight, isGeneratingInsight, onGenerateInsight 등)
 * @output AI 인사이트 생성 버튼, 로딩 상태, 결과 표시 UI 렌더링
 * @external_dependencies 없음 (순수 UI 컴포넌트, AI 호출은 상위에서 처리)
 */

import type { InsightsTabProps } from './types';

/**
 * AI 기반 생산성 인사이트 생성 및 표시 탭
 * @param props - InsightsTabProps
 * @param props.insight - 생성된 인사이트 텍스트
 * @param props.isGeneratingInsight - 인사이트 생성 중 여부
 * @param props.insightError - 에러 메시지
 * @param props.onGenerateInsight - 인사이트 생성 핸들러
 * @returns AI 인사이트 UI 엘리먼트
 */
export function InsightsTab({
    insight,
    isGeneratingInsight,
    insightError,
    onGenerateInsight,
}: InsightsTabProps) {
    return (
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="text-6xl animate-bounce">💡</div>
            <h3 className="text-2xl font-bold">AI 인사이트</h3>

            {!insight && !isGeneratingInsight && (
                <div className="text-center space-y-4 max-w-md">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        최근 활동 데이터를 분석하여<br />
                        맞춤형 생산성 인사이트와 조언을 제공합니다.
                    </p>
                    <button
                        onClick={onGenerateInsight}
                        className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold shadow-lg hover:bg-opacity-90 transition transform hover:scale-105"
                    >
                        ✨ 인사이트 생성하기
                    </button>
                    {insightError && (
                        <p className="text-sm text-[var(--color-warning)]">{insightError}</p>
                    )}
                </div>
            )}

            {isGeneratingInsight && (
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        데이터를 분석하고 있습니다...<br />
                        잠시만 기다려주세요.
                    </p>
                </div>
            )}

            {insight && !isGeneratingInsight && (
                <div className="w-full max-w-3xl space-y-4">
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-sm">
                        <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed text-[var(--color-text)]">
                            {insight}
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <button
                            onClick={onGenerateInsight}
                            className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition flex items-center gap-2"
                        >
                            🔄 다시 생성하기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

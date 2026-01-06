/**
 * @file DailySummaryModal.tsx
 * @description AI 하루 요약 보고서 모달
 * 
 * @role 어제/오늘의 종합 보고서를 AI가 생성하여 제공
 * @responsibilities
 *   - 어제/오늘 보고서 탭 전환
 *   - 통계, 할일목록, AI 분석 페이지 구분
 *   - 보고서 다운로드 기능 (TXT/Markdown)
 *   - 보고서 캐싱 (Dexie)
 * @dependencies
 *   - Gemini API: AI 보고서 생성
 *   - dailyDataRepository: 일일 데이터 조회
 *   - completedTasksStore: 완료된 작업 데이터
 */

import { BarChart3, Calendar, CheckSquare, ChevronLeft, ChevronRight, Download, FileText, RefreshCw, Sparkles, X } from 'lucide-react';

import { useModalEscapeClose } from '@/shared/hooks';

import { AIAnalysisSection } from './daily-summary/components/ai-analysis-section';
import { OverviewSection } from './daily-summary/components/overview-section';
import { TasksSection } from './daily-summary/components/tasks-section';
import { useDailySummaryController } from './daily-summary/hooks/use-daily-summary-controller';
import type { DailySummaryModalProps, ReportPage } from './daily-summary/types';
import { formatDateKorean, resolveReportDate } from './daily-summary/utils/report-date';
import { downloadReport } from './daily-summary/utils/report-download';

// ============================================================================
// Constants
// ============================================================================

const PAGE_CONFIG = {
  overview: { icon: BarChart3, label: '개요', color: 'text-blue-400' },
  tasks: { icon: CheckSquare, label: '할일 목록', color: 'text-green-400' },
  'ai-analysis': { icon: Sparkles, label: 'AI 분석', color: 'text-amber-400' },
} as const;

// ============================================================================
// Main Component
// ============================================================================

export default function DailySummaryModal({ open, onClose }: DailySummaryModalProps) {
  const {
    reportDate,
    currentPage,
    setCurrentPage,
    report,
    isLoading,
    isRegenerating,
    error,
    targetDate,
    pages,
    loadReport,
    handleRegenerate,
    handleDateSelect,
  } = useDailySummaryController({ open });

  useModalEscapeClose(open, onClose);

  if (!open) return null;

  const orderedPages: readonly ReportPage[] = pages;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="relative z-10 w-[600px] max-h-[90vh] rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/20">
              <FileText size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI 하루 요약</h2>
              <p className="text-xs text-slate-400">{formatDateKorean(targetDate)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Date Selection - Click to generate report */}
        <div className="flex flex-col items-center gap-4 px-6 py-6 bg-slate-900/50 border-b border-slate-800/50">
          <p className="text-sm text-slate-400">보고서를 생성할 날짜를 선택하세요</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                handleDateSelect('yesterday');
                const selectedDate = resolveReportDate('yesterday');
                void loadReport(selectedDate, false);
              }}
              disabled={isLoading}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition ${
                reportDate === 'yesterday' && report
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-blue-500/50 hover:text-blue-400'
              } disabled:opacity-50`}
            >
              <ChevronLeft size={16} />
              어제 보고서
            </button>
            <button
              onClick={() => {
                handleDateSelect('today');
                const selectedDate = resolveReportDate('today');
                void loadReport(selectedDate, false);
              }}
              disabled={isLoading}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition ${
                reportDate === 'today' && report
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-blue-500/50 hover:text-blue-400'
              } disabled:opacity-50`}
            >
              오늘 보고서
              <ChevronRight size={16} />
            </button>
          </div>
          {report && (
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Calendar size={12} />
              <span>선택된 날짜: {formatDateKorean(targetDate)}</span>
            </div>
          )}
        </div>

        {/* Page Tabs - Only show when report exists */}
        {report && (
          <div className="flex items-center gap-1 px-6 py-3 bg-slate-900/30 border-b border-slate-800/50">
            {orderedPages.map((page) => {
              const config = PAGE_CONFIG[page];
              const Icon = config.icon;
              const isActive = currentPage === page;
              
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? `bg-slate-800 ${config.color} border border-slate-700`
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon size={14} />
                  {config.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-400 animate-spin" />
              <p className="text-sm text-slate-400">보고서를 생성하고 있습니다...</p>
              <p className="text-xs text-slate-500">AI가 데이터를 분석 중입니다. 잠시만 기다려주세요...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <span className="text-4xl">⚠️</span>
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => loadReport(targetDate, true)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 transition"
              >
                다시 시도
              </button>
            </div>
          ) : report ? (
            <>
              {currentPage === 'overview' && <OverviewSection report={report} />}
              {currentPage === 'tasks' && <TasksSection report={report} />}
              {currentPage === 'ai-analysis' && (
                <AIAnalysisSection
                  report={report}
                  isGenerating={isRegenerating}
                  onRegenerate={handleRegenerate}
                />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl rounded-full"></div>
                <span className="relative text-6xl">📊</span>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-slate-200">AI 하루 요약</h3>
                <p className="text-sm text-slate-500">위에서 어제 또는 오늘 보고서 버튼을 클릭하여<br/>AI가 생성한 상세 분석 보고서를 확인하세요.</p>
              </div>
              <div className="flex flex-col items-center gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} />
                  <span>XP 통계 및 달성률</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckSquare size={14} />
                  <span>완료/미완료 작업 목록</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} />
                  <span>AI 패턴 분석 및 개선 제안</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {report && (
              <>
                <span>생성: {new Date(report.generatedAt).toLocaleTimeString('ko-KR')}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <>
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading || isRegenerating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 transition disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                  새로 생성
                </button>
                <div className="flex items-center">
                  <button
                    onClick={() => downloadReport(report, 'md')}
                    className="flex items-center gap-2 px-4 py-2 rounded-l-xl bg-gradient-to-r from-blue-500 to-blue-600 text-sm font-medium text-white hover:from-blue-600 hover:to-blue-700 transition"
                  >
                    <Download size={14} />
                    MD
                  </button>
                  <button
                    onClick={() => downloadReport(report, 'txt')}
                    className="flex items-center gap-2 px-4 py-2 rounded-r-xl bg-gradient-to-r from-purple-500 to-purple-600 text-sm font-medium text-white hover:from-purple-600 hover:to-purple-700 transition border-l border-purple-400/30"
                  >
                    TXT
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

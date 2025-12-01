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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Download, RefreshCw, Calendar, BarChart3, CheckSquare, Sparkles, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { getLocalDate, calculateTaskXP } from '@/shared/lib/utils';
import { loadDailyData } from '@/data/repositories/dailyDataRepository';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { callGeminiAPI } from '@/shared/services/ai/geminiApi';
import { db } from '@/data/db/dexieClient';
import type { DailyData, Task } from '@/shared/types/domain';

// ============================================================================
// Types
// ============================================================================

interface DailySummaryModalProps {
  open: boolean;
  onClose: () => void;
}

type ReportDate = 'today' | 'yesterday';
type ReportPage = 'overview' | 'tasks' | 'ai-analysis';

interface DailyReport {
  date: string;
  generatedAt: string;
  overview: {
    totalXP: number;
    completedTasks: number;
    totalTasks: number;
    completionRate: number;
    focusMinutes: number;
    blocksCompleted: number;
    totalBlocks: number;
  };
  tasks: {
    completed: TaskSummary[];
    uncompleted: TaskSummary[];
  };
  aiAnalysis: string;
}

interface TaskSummary {
  id: string;
  text: string;
  xp: number;
  blockId: string | null;
  completed: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const REPORT_CACHE_KEY_PREFIX = 'daily_summary_report';

const PAGE_CONFIG = {
  overview: { icon: BarChart3, label: '개요', color: 'text-blue-400' },
  tasks: { icon: CheckSquare, label: '할일 목록', color: 'text-green-400' },
  'ai-analysis': { icon: Sparkles, label: 'AI 분석', color: 'text-amber-400' },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    weekday: 'long' 
  };
  return date.toLocaleDateString('ko-KR', options);
}

function getCacheKey(date: string): string {
  return `${REPORT_CACHE_KEY_PREFIX}:${date}`;
}

// ============================================================================
// Report Generation
// ============================================================================

async function generateAIAnalysis(
  dailyData: DailyData | null,
  apiKey: string,
  date: string
): Promise<string> {
  if (!dailyData || !apiKey) {
    return '데이터가 없거나 API 키가 설정되지 않았습니다.';
  }

  const tasks = dailyData.tasks || [];
  const completedTasks = tasks.filter(t => t.completed);
  const uncompletedTasks = tasks.filter(t => !t.completed);
  const totalXP = completedTasks.reduce((sum, t) => sum + calculateTaskXP(t), 0);

  const prompt = `당신은 생산성 코치입니다. 사용자의 하루 데이터를 분석하고 인사이트를 제공해주세요.

## 분석 대상 날짜
${date} (${formatDate(date)})

## 데이터 요약
- 총 작업: ${tasks.length}개
- 완료된 작업: ${completedTasks.length}개 (${tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%)
- 미완료 작업: ${uncompletedTasks.length}개
- 획득 XP: ${totalXP}

## 완료된 작업
${completedTasks.map(t => `- ${t.text} (+${calculateTaskXP(t)}XP)`).join('\n') || '없음'}

## 미완료 작업
${uncompletedTasks.map(t => `- ${t.text}`).join('\n') || '없음'}

## 출력 형식
다음 형식으로 분석 결과를 작성해주세요:

### 🎯 오늘의 성과
(완료한 작업들에 대한 긍정적 피드백)

### 📊 패턴 분석
(작업 완료 패턴, 생산성 추세 분석)

### 💡 개선 제안
(미완료 작업이 있다면 그 원인 분석과 개선 방법)

### ⭐ 내일을 위한 팁
(다음 날 더 나은 하루를 위한 구체적인 조언)

한국어로 작성하고, 친근하면서도 전문적인 톤으로 작성해주세요.`;

  try {
    // callGeminiAPI(prompt, history, apiKey, model) 시그니처 사용
    const systemPrompt = '당신은 친근하고 전문적인 생산성 코치입니다. 사용자의 일일 데이터를 분석하고 통찰력 있는 피드백을 제공합니다.';
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    const result = await callGeminiAPI(fullPrompt, [], apiKey);

    return result.text;
  } catch (error) {
    console.error('AI 분석 생성 실패:', error);
    return `AI 분석 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
  }
}

async function buildDailyReport(
  date: string,
  dailyData: DailyData | null,
  apiKey: string
): Promise<DailyReport> {
  const tasks = dailyData?.tasks || [];
  const completedTasks = tasks.filter(t => t.completed);
  const uncompletedTasks = tasks.filter(t => !t.completed);

  const taskToSummary = (task: Task): TaskSummary => ({
    id: task.id,
    text: task.text,
    xp: calculateTaskXP(task),
    blockId: task.timeBlock,
    completed: task.completed,
  });

  const totalXP = completedTasks.reduce((sum, t) => sum + calculateTaskXP(t), 0);
  const blocksWithTasks = new Set(tasks.filter(t => t.timeBlock).map(t => t.timeBlock));
  const blocksCompleted = Array.from(blocksWithTasks).filter(blockId => {
    const blockTasks = tasks.filter(t => t.timeBlock === blockId);
    return blockTasks.every(t => t.completed);
  }).length;

  // Generate AI analysis
  const aiAnalysis = await generateAIAnalysis(dailyData, apiKey, date);

  return {
    date,
    generatedAt: new Date().toISOString(),
    overview: {
      totalXP,
      completedTasks: completedTasks.length,
      totalTasks: tasks.length,
      completionRate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
      focusMinutes: 0, // TODO: 실제 포커스 타이머 데이터 연동
      blocksCompleted,
      totalBlocks: blocksWithTasks.size,
    },
    tasks: {
      completed: completedTasks.map(taskToSummary),
      uncompleted: uncompletedTasks.map(taskToSummary),
    },
    aiAnalysis,
  };
}

// ============================================================================
// Download Utils
// ============================================================================

function downloadReport(report: DailyReport, format: 'txt' | 'md') {
  const dateStr = report.date;
  const formattedDate = formatDate(dateStr);

  let content = '';

  if (format === 'md') {
    content = `# 📊 일일 보고서: ${formattedDate}

## 📈 개요
| 항목 | 값 |
|------|-----|
| 총 XP | ${report.overview.totalXP} |
| 완료 작업 | ${report.overview.completedTasks}/${report.overview.totalTasks} (${report.overview.completionRate}%) |
| 완료 블록 | ${report.overview.blocksCompleted}/${report.overview.totalBlocks} |

## ✅ 완료된 작업
${report.tasks.completed.map(t => `- [x] ${t.text} (+${t.xp}XP)`).join('\n') || '없음'}

## ⏳ 미완료 작업
${report.tasks.uncompleted.map(t => `- [ ] ${t.text}`).join('\n') || '없음'}

## 🤖 AI 분석
${report.aiAnalysis}

---
*생성 시각: ${new Date(report.generatedAt).toLocaleString('ko-KR')}*
`;
  } else {
    content = `📊 일일 보고서: ${formattedDate}
${'='.repeat(50)}

📈 개요
- 총 XP: ${report.overview.totalXP}
- 완료 작업: ${report.overview.completedTasks}/${report.overview.totalTasks} (${report.overview.completionRate}%)
- 완료 블록: ${report.overview.blocksCompleted}/${report.overview.totalBlocks}

✅ 완료된 작업
${report.tasks.completed.map(t => `  ✓ ${t.text} (+${t.xp}XP)`).join('\n') || '  없음'}

⏳ 미완료 작업
${report.tasks.uncompleted.map(t => `  ○ ${t.text}`).join('\n') || '  없음'}

🤖 AI 분석
${'-'.repeat(50)}
${report.aiAnalysis}

---
생성 시각: ${new Date(report.generatedAt).toLocaleString('ko-KR')}
`;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-report-${dateStr}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Components
// ============================================================================

interface OverviewSectionProps {
  report: DailyReport;
}

function OverviewSection({ report }: OverviewSectionProps) {
  const { overview } = report;

  const statCards = [
    { label: '총 XP', value: overview.totalXP.toLocaleString(), icon: '⭐', color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30' },
    { label: '완료율', value: `${overview.completionRate}%`, icon: '📊', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30' },
    { label: '완료 작업', value: `${overview.completedTasks}/${overview.totalTasks}`, icon: '✅', color: 'from-green-500/20 to-green-600/20 border-green-500/30' },
    { label: '완료 블록', value: `${overview.blocksCompleted}/${overview.totalBlocks}`, icon: '🧱', color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl bg-gradient-to-br ${stat.color} border p-4 backdrop-blur-sm`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{stat.icon}</span>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Ring */}
      <div className="flex items-center justify-center py-6">
        <div className="relative">
          <svg className="w-40 h-40 transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-slate-700"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="url(#progressGradient)"
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${(overview.completionRate / 100) * 440} 440`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{overview.completionRate}%</span>
            <span className="text-xs text-slate-400">달성률</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TasksSectionProps {
  report: DailyReport;
}

function TasksSection({ report }: TasksSectionProps) {
  const { tasks } = report;

  return (
    <div className="space-y-6">
      {/* Completed Tasks */}
      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-green-400 mb-3">
          <CheckSquare size={16} />
          완료된 작업 ({tasks.completed.length})
        </h4>
        {tasks.completed.length === 0 ? (
          <p className="text-sm text-slate-500 italic">완료된 작업이 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
            {tasks.completed.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-200">{task.text}</span>
                </div>
                <span className="text-xs font-medium text-amber-400">+{task.xp}XP</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Uncompleted Tasks */}
      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-400 mb-3">
          <span className="w-4 h-4 rounded border-2 border-orange-400/50" />
          미완료 작업 ({tasks.uncompleted.length})
        </h4>
        {tasks.uncompleted.length === 0 ? (
          <p className="text-sm text-slate-500 italic">모든 작업을 완료했습니다! 🎉</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
            {tasks.uncompleted.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded border-2 border-orange-400/30" />
                  <span className="text-sm text-slate-300">{task.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AIAnalysisSectionProps {
  report: DailyReport;
  isGenerating: boolean;
  onRegenerate: () => void;
}

function AIAnalysisSection({ report, isGenerating, onRegenerate }: AIAnalysisSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-400">
          <Sparkles size={16} />
          AI 분석 리포트
        </h4>
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition disabled:opacity-50"
        >
          <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} />
          다시 생성
        </button>
      </div>

      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5 backdrop-blur-sm">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-amber-500/30 border-t-amber-400 animate-spin" />
            <p className="text-sm text-slate-400">AI가 분석 중입니다...</p>
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
              {report.aiAnalysis}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function DailySummaryModal({ open, onClose }: DailySummaryModalProps) {
  const { settings } = useSettingsStore();
  
  const [reportDate, setReportDate] = useState<ReportDate>('today');
  const [currentPage, setCurrentPage] = useState<ReportPage>('overview');
  const [report, setReport] = useState<DailyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetDate = useMemo(() => {
    return reportDate === 'today' ? getLocalDate() : getYesterday();
  }, [reportDate]);

  // Load or generate report
  const loadReport = useCallback(async (forceRegenerate = false) => {
    if (!settings?.geminiApiKey) {
      setError('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
      return;
    }

    const cacheKey = getCacheKey(targetDate);
    
    // Try loading from cache first
    if (!forceRegenerate) {
      try {
        const cached = await db.systemState.get(cacheKey);
        if (cached?.value) {
          setReport(cached.value as DailyReport);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Failed to load cached report:', e);
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const dailyData = await loadDailyData(targetDate);
      const newReport = await buildDailyReport(targetDate, dailyData, settings.geminiApiKey);
      
      // Cache the report
      try {
        await db.systemState.put({ key: cacheKey, value: newReport });
      } catch (e) {
        console.warn('Failed to cache report:', e);
      }

      setReport(newReport);
    } catch (e) {
      console.error('Failed to generate report:', e);
      setError(`보고서 생성 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  }, [targetDate, settings?.geminiApiKey]);

  // Handle regeneration
  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    await loadReport(true);
    setIsRegenerating(false);
  }, [loadReport]);

  // Load report when modal opens or date changes
  useEffect(() => {
    if (open) {
      loadReport();
    }
  }, [open, targetDate, loadReport]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentPage('overview');
      setReport(null);
      setError(null);
    }
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setReportDate(prev => prev === 'today' ? 'yesterday' : 'today');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const pages: ReportPage[] = ['overview', 'tasks', 'ai-analysis'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
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
              <p className="text-xs text-slate-400">{formatDate(targetDate)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Date Toggle */}
        <div className="flex items-center justify-center gap-4 px-6 py-3 bg-slate-900/50 border-b border-slate-800/50">
          <button
            onClick={() => setReportDate('yesterday')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              reportDate === 'yesterday'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ChevronLeft size={16} />
            어제
          </button>
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar size={14} />
            <span className="text-xs">{targetDate}</span>
          </div>
          <button
            onClick={() => setReportDate('today')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              reportDate === 'today'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            오늘
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Page Tabs */}
        <div className="flex items-center gap-1 px-6 py-3 bg-slate-900/30 border-b border-slate-800/50">
          {pages.map((page) => {
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-400 animate-spin" />
              <p className="text-sm text-slate-400">보고서를 생성하고 있습니다...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <span className="text-4xl">⚠️</span>
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => loadReport(true)}
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
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <span className="text-4xl">📊</span>
              <p className="text-sm text-slate-500">보고서를 생성해주세요.</p>
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
            <button
              onClick={handleRegenerate}
              disabled={isLoading || isRegenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
              새로 생성
            </button>
            {report && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @file ai-analysis-section.tsx
 * @description AI analysis page section for DailySummaryModal.
 */

import { RefreshCw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { DailyReport } from '../types';

export interface AIAnalysisSectionProps {
  readonly report: DailyReport;
  readonly isGenerating: boolean;
  readonly onRegenerate: () => void;
}

export const AIAnalysisSection = ({ report, isGenerating, onRegenerate }: AIAnalysisSectionProps) => {
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

      <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5 backdrop-blur-sm max-h-[400px] overflow-y-auto scrollbar-thin">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-amber-500/30 border-t-amber-400 animate-spin" />
            <p className="text-sm text-slate-400">AI가 분석 중입니다...</p>
          </div>
        ) : (
          <div
            className="prose prose-sm prose-invert max-w-none
            prose-headings:text-slate-100 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
            prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
            prose-p:text-slate-300 prose-p:my-2 prose-p:leading-relaxed
            prose-strong:text-amber-400 prose-strong:font-bold
            prose-em:text-slate-400 prose-em:italic
            prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
            prose-li:text-slate-300 prose-li:my-1
            prose-code:text-amber-400 prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
            prose-pre:bg-slate-900/50 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-xl prose-pre:p-3 prose-pre:my-2
            prose-blockquote:border-l-2 prose-blockquote:border-amber-400 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-400
            prose-a:text-blue-400 prose-a:underline
            prose-hr:border-slate-700 prose-hr:my-3"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.aiAnalysis}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * @file report-download.ts
 * @description Download helpers for daily summary report.
 */

import type { DailyReport } from '../types';
import { formatDateKorean } from './report-date';

export type ReportDownloadFormat = 'txt' | 'md';

/**
 * Triggers a browser download for the given report.
 * @param report - Report to download.
 * @param format - File format.
 */
export const downloadReport = (report: DailyReport, format: ReportDownloadFormat): void => {
  const dateStr = report.date;
  const formattedDate = formatDateKorean(dateStr);

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
};

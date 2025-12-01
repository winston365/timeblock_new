/**
 * Role: Custom hook for task context suggestion based on historical patterns.
 * Dependencies: RAG autoTagService for similarity analysis.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import type { Resistance } from '@/shared/types/domain';
import { suggestTaskContext, type TaskContextSuggestion } from '@/shared/services/rag/autoTagService';

interface UseTaskContextSuggestionReturn {
  contextSuggestion: TaskContextSuggestion | null;
  contextLoading: boolean;
  appliedFields: Set<string>;
  applyContextDuration: (setBaseDuration: (duration: number) => void) => void;
  applyContextResistance: (setResistance: (resistance: Resistance) => void) => void;
  applyContextPreparation: (
    preparationItem: string,
    preparation1: string,
    preparation2: string,
    preparation3: string,
    setPreparation1: (v: string) => void,
    setPreparation2: (v: string) => void,
    setPreparation3: (v: string) => void
  ) => void;
  applyContextMemo: (snippet: string, memo: string, setMemo: (v: string) => void) => void;
  applyAll: (
    setBaseDuration: (duration: number) => void,
    setResistance: (resistance: Resistance) => void,
    preparation1: string,
    preparation2: string,
    preparation3: string,
    setPreparation1: (v: string) => void,
    setPreparation2: (v: string) => void,
    setPreparation3: (v: string) => void
  ) => void;
}

/**
 * Hook to manage task context suggestions from historical patterns.
 * Provides debounced similarity search and apply handlers.
 */
export function useTaskContextSuggestion(
  taskText: string,
  debounceMs = 500
): UseTaskContextSuggestionReturn {
  const [contextSuggestion, setContextSuggestion] = useState<TaskContextSuggestion | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());

  // Mark a field as applied with auto-clear
  const markApplied = useCallback((field: string) => {
    setAppliedFields(prev => new Set(prev).add(field));
    setTimeout(() => {
      setAppliedFields(prev => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }, 1500);
  }, []);

  // Debounced context lookup
  useEffect(() => {
    const trimmedText = taskText.trim();
    if (trimmedText.length < 5) {
      setContextSuggestion(null);
      return;
    }

    const suggestionTimeoutId = setTimeout(async () => {
      setContextLoading(true);
      try {
        const suggestedContext = await suggestTaskContext(trimmedText);
        setContextSuggestion(suggestedContext);
      } catch (contextSuggestionError) {
        console.error('맥락 추천 실패:', contextSuggestionError);
      } finally {
        setContextLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(suggestionTimeoutId);
  }, [taskText, debounceMs]);

  // Duration options for snapping
  const durationOptions = [5, 10, 15, 30, 45, 60, 90, 120];
  const findClosestDuration = (avgDuration: number) =>
    durationOptions.reduce((prev, curr) =>
      Math.abs(curr - avgDuration) < Math.abs(prev - avgDuration) ? curr : prev
    );

  // Apply handlers
  const applyContextDuration = useCallback(
    (setBaseDuration: (duration: number) => void) => {
      if (contextSuggestion?.avgDuration) {
        const closestDuration = findClosestDuration(contextSuggestion.avgDuration);
        setBaseDuration(closestDuration);
        markApplied('duration');
        toast.success(`소요 시간 ${closestDuration}분 적용됨`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextSuggestion, markApplied]
  );

  const applyContextResistance = useCallback(
    (setResistance: (resistance: Resistance) => void) => {
      if (contextSuggestion?.commonResistance) {
        setResistance(contextSuggestion.commonResistance.level);
        markApplied('resistance');
        toast.success(`난이도 ${contextSuggestion.commonResistance.label} 적용됨`);
      }
    },
    [contextSuggestion, markApplied]
  );

  const applyContextPreparation = useCallback(
    (
      preparationItem: string,
      preparation1: string,
      preparation2: string,
      preparation3: string,
      setPreparation1: (v: string) => void,
      setPreparation2: (v: string) => void,
      setPreparation3: (v: string) => void
    ) => {
      if (!preparation1) {
        setPreparation1(preparationItem);
        markApplied('prep1');
      } else if (!preparation2) {
        setPreparation2(preparationItem);
        markApplied('prep2');
      } else if (!preparation3) {
        setPreparation3(preparationItem);
        markApplied('prep3');
      } else {
        toast.error('준비물이 모두 채워져 있습니다');
        return;
      }
      toast.success(`준비물 "${preparationItem}" 추가됨`);
    },
    [markApplied]
  );

  const applyContextMemo = useCallback(
    (snippet: string, memo: string, setMemo: (v: string) => void) => {
      const newMemo = memo.trim() ? `${memo.trim()}\n${snippet}` : snippet;
      setMemo(newMemo);
      markApplied('memo');
      toast.success('메모에 추가됨');
    },
    [markApplied]
  );

  const applyAll = useCallback(
    (
      setBaseDuration: (duration: number) => void,
      setResistance: (resistance: Resistance) => void,
      preparation1: string,
      preparation2: string,
      preparation3: string,
      setPreparation1: (v: string) => void,
      setPreparation2: (v: string) => void,
      setPreparation3: (v: string) => void
    ) => {
      let appliedCount = 0;

      if (contextSuggestion?.avgDuration) {
        const closestDuration = findClosestDuration(contextSuggestion.avgDuration);
        setBaseDuration(closestDuration);
        markApplied('duration');
        appliedCount++;
      }

      if (contextSuggestion?.commonResistance) {
        setResistance(contextSuggestion.commonResistance.level);
        markApplied('resistance');
        appliedCount++;
      }

      // Apply preparations to empty slots only
      const preparationSuggestions = contextSuggestion?.commonPreparations || [];
      if (preparationSuggestions.length > 0 && !preparation1) {
        setPreparation1(preparationSuggestions[0]);
        markApplied('prep1');
        appliedCount++;
      }
      if (preparationSuggestions.length > 1 && !preparation2) {
        setPreparation2(preparationSuggestions[1]);
        markApplied('prep2');
        appliedCount++;
      }
      if (preparationSuggestions.length > 2 && !preparation3) {
        setPreparation3(preparationSuggestions[2]);
        markApplied('prep3');
        appliedCount++;
      }

      if (appliedCount > 0) {
        toast.success(`${appliedCount}개 항목 적용됨`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextSuggestion, markApplied]
  );

  return {
    contextSuggestion,
    contextLoading,
    appliedFields,
    applyContextDuration,
    applyContextResistance,
    applyContextPreparation,
    applyContextMemo,
    applyAll,
  };
}

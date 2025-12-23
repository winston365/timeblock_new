/**
 * Template 관련 Zod 스키마
 *
 * @role 템플릿 생성/수정 시 폼 유효성 검증
 * @input 사용자 입력 데이터
 * @output Zod 스키마 및 타입
 */

import { z } from 'zod';

/**
 * 저항감 레벨 스키마
 */
export const resistanceSchema = z.enum(['low', 'medium', 'high']);

/**
 * 반복 주기 스키마
 */
export const recurrenceTypeSchema = z.enum(['none', 'daily', 'weekly', 'interval']);

/**
 * 타임블록 ID 스키마
 */
export const timeBlockIdSchema = z.union([
  z.enum(['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night']),
  // Legacy IDs
  z.enum(['5-8', '8-11', '11-14', '14-17', '17-20', '20-23']),
  z.null(),
]);

/**
 * 템플릿 기본 정보 스키마 (1단계)
 */
export const templateBasicSchema = z.object({
  text: z
    .string()
    .min(1, '할 일 이름을 입력해주세요.')
    .max(100, '할 일 이름은 100자 이하로 입력해주세요.'),
  memo: z.string().max(500, '메모는 500자 이하로 입력해주세요.').default(''),
  baseDuration: z
    .number()
    .min(1, '소요 시간은 최소 1분 이상이어야 합니다.')
    .max(480, '소요 시간은 최대 480분(8시간) 이하로 입력해주세요.'),
  resistance: resistanceSchema,
  timeBlock: timeBlockIdSchema,
  category: z.string().max(50, '카테고리는 50자 이하로 입력해주세요.').default(''),
  imageUrl: z.string().url('올바른 URL 형식을 입력해주세요.').or(z.literal('')).default(''),
  isFavorite: z.boolean().default(false),
});

/**
 * 준비 사항 스키마 (2단계)
 */
export const templatePreparationSchema = z.object({
  preparation1: z.string().max(200, '예상 방해물은 200자 이하로 입력해주세요.').default(''),
  preparation2: z.string().max(200, '예상 방해물은 200자 이하로 입력해주세요.').default(''),
  preparation3: z.string().max(200, '대처 전략은 200자 이하로 입력해주세요.').default(''),
});

/**
 * 반복 설정 스키마 (3단계)
 * superRefine을 사용하여 특정 필드에 에러를 연결
 */
export const templateRecurrenceSchema = z
  .object({
    autoGenerate: z.boolean().default(false),
    recurrenceType: recurrenceTypeSchema.default('none'),
    weeklyDays: z.array(z.number().min(0).max(6)).default([]),
    intervalDays: z.number().min(1).max(365).default(1),
  })
  .superRefine((data, ctx) => {
    // autoGenerate가 true이면 recurrenceType이 'none'이 아니어야 함
    if (data.autoGenerate && data.recurrenceType === 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '자동 생성을 켜면 반복 주기를 선택해야 합니다.',
        path: ['recurrenceType'],
      });
    }
    // weekly 선택 시 최소 1개 요일 필요
    if (data.recurrenceType === 'weekly' && data.weeklyDays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '매주 반복 시 최소 1개 요일을 선택해야 합니다.',
        path: ['weeklyDays'],
      });
    }
  });

/**
 * 전체 템플릿 폼 스키마
 */
export const templateFormSchema = templateBasicSchema
  .merge(templatePreparationSchema)
  .merge(templateRecurrenceSchema);

/**
 * 빠른 생성 스키마 (1단계 즉시 저장)
 */
export const templateQuickCreateSchema = z.object({
  text: z
    .string()
    .min(1, '할 일 이름을 입력해주세요.')
    .max(100, '할 일 이름은 100자 이하로 입력해주세요.'),
  baseDuration: z.number().min(1).max(480).default(30),
  resistance: resistanceSchema.default('low'),
});

/**
 * 타입 추출
 */
export type TemplateBasicForm = z.infer<typeof templateBasicSchema>;
export type TemplatePreparationForm = z.infer<typeof templatePreparationSchema>;
export type TemplateRecurrenceForm = z.infer<typeof templateRecurrenceSchema>;
export type TemplateFormData = z.infer<typeof templateFormSchema>;
export type TemplateQuickCreate = z.infer<typeof templateQuickCreateSchema>;

/**
 * 유효성 검사 결과 타입
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

/**
 * 단계별 유효성 검사 함수
 */
export function validateBasicStep(data: unknown): ValidationResult<TemplateBasicForm> {
  const result = templateBasicSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

export function validatePreparationStep(data: unknown): ValidationResult<TemplatePreparationForm> {
  const result = templatePreparationSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

export function validateRecurrenceStep(data: unknown): ValidationResult<TemplateRecurrenceForm> {
  const result = templateRecurrenceSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

export function validateFullForm(data: unknown): ValidationResult<TemplateFormData> {
  const result = templateFormSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.issues.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return { success: false, errors };
}

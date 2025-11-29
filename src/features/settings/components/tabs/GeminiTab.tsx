/**
 * GeminiTab
 *
 * @role Gemini AI API 설정 탭
 * @input GeminiTabProps (localSettings, setLocalSettings)
 * @output AI API 키, 모델명, 자동 이모지 설정 UI 렌더링
 * @external_dependencies 없음 (순수 UI 컴포넌트)
 */

import type { GeminiTabProps, Settings } from './types';
import { sectionClass, sectionDescriptionClass, formGroupClass, inputClass, infoBoxClass } from './styles';

export function GeminiTab({ localSettings, setLocalSettings }: GeminiTabProps) {
    return (
        <div className={sectionClass}>
            <h3>🤖 Gemini AI 설정</h3>
            <p className={sectionDescriptionClass}>
                Google Gemini API를 사용하여 AI 챗봇 및 인사이트 기능을 이용할 수 있습니다.
            </p>

            <div className={formGroupClass}>
                <label htmlFor="gemini-api-key">
                    Gemini API 키 <span className="required">*</span>
                </label>
                <input
                    id="gemini-api-key"
                    type="password"
                    className={inputClass}
                    placeholder="AIzaSy..."
                    value={localSettings?.geminiApiKey || ''}
                    onChange={(e) =>
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, geminiApiKey: e.target.value }) : prev)
                    }
                />
                <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                    <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        API 키 발급받기 →
                    </a>
                </small>
            </div>

            <div className={formGroupClass}>
                <label htmlFor="gemini-model">
                    Gemini 모델명
                </label>
                <input
                    id="gemini-model"
                    type="text"
                    className={inputClass}
                    placeholder="gemini-3-pro-preview"
                    value={localSettings?.geminiModel || ''}
                    onChange={(e) =>
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, geminiModel: e.target.value }) : prev)
                    }
                />
                <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                    사용할 Gemini 모델명을 입력하세요. (예: gemini-3-pro-preview, gemini-2.0-flash-exp, gemini-1.5-pro)
                </small>
            </div>

            <div className={formGroupClass}>
                <label htmlFor="github-token">
                    GitHub 토큰 (폴더 음원 목록 불러오기용)
                </label>
                <input
                    id="github-token"
                    type="password"
                    className={inputClass}
                    placeholder="ghp_... (옵션, 없으면 60req/h 제한)"
                    value={localSettings?.githubToken || ''}
                    onChange={(e) =>
                        setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, githubToken: e.target.value }) : prev)
                    }
                />
                <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                    공개 리포만 쓴다면 비워도 됩니다. 토큰은 로컬에만 저장되어 동기화되지 않습니다.
                </small>
            </div>

            <div className={`${formGroupClass} flex-col items-start gap-2`}>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-[var(--color-text)]">작업 자동 이모지</span>
                    <span className="text-[0.8rem] text-[var(--color-text-tertiary)]">
                        제목 기반 추천 이모지를 접두로 붙입니다 (비용 절약을 위해 기본 OFF)
                    </span>
                </div>
                <label className="inline-flex items-center cursor-pointer select-none">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={!!localSettings?.autoEmojiEnabled}
                        onChange={(e) =>
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, autoEmojiEnabled: e.target.checked }) : prev)
                        }
                    />
                    <div className="flex h-9 w-16 items-center rounded-full border border-white/10 bg-[var(--color-bg-tertiary)] transition peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] shadow-sm">
                        <span className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--color-text-primary)] text-sm font-bold transition-all duration-200 peer-checked:translate-x-6 peer-checked:text-[var(--color-primary-dark)]">
                            {localSettings?.autoEmojiEnabled ? 'ON' : 'OFF'}
                        </span>
                    </div>
                </label>
            </div>

            <div className={infoBoxClass}>
                <strong>💡 참고:</strong> Gemini API 키가 없어도 앱의 다른 기능은 정상적으로
                사용할 수 있습니다. AI 챗봇 및 인사이트 기능만 제한됩니다.
            </div>
        </div>
    );
}

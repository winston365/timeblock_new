/**
 * SettingsModal
 *
 * @role Gemini API 키, Firebase 설정, 테마 설정을 관리하는 모달 컴포넌트
 * @input isOpen (모달 표시 여부), onClose (모달 닫기), onSaved (저장 완료 콜백)
 * @output 탭 기반 설정 UI (테마, Gemini, Firebase)
 * @external_dependencies
 *   - settingsRepository: 설정 데이터 로드/저장
 *   - firebaseService: Firebase 초기화
 */

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '@/data/repositories/settingsRepository';
import { initializeFirebase } from '@/shared/services/firebaseService';
import type { Settings } from '@/shared/types/domain';
import './settings.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * 설정 모달 컴포넌트
 *
 * @param {SettingsModalProps} props - 컴포넌트 props
 * @returns {JSX.Element | null} 설정 모달 또는 null
 * @sideEffects
 *   - 설정 데이터 로드/저장
 *   - Firebase 재초기화
 *   - 테마 변경 시 DOM 및 localStorage 업데이트
 */
export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: '',
    autoMessageInterval: 30,
    autoMessageEnabled: false,
    waifuMode: 'characteristic',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'gemini' | 'firebase' | 'appearance'>('gemini');
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('theme') || '';
  });

  // 설정 로드
  useEffect(() => {
    if (isOpen) {
      loadSettingsData();
    }
  }, [isOpen]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const data = await loadSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // 테마 변경
  const handleThemeChange = (theme: string) => {
    setCurrentTheme(theme);
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    }
  };

  // 설정 저장
  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSettings(settings);

      // Firebase 설정이 있으면 재초기화
      if (settings.firebaseConfig) {
        const initialized = initializeFirebase(settings.firebaseConfig);
        if (initialized) {
        }
      }

      alert('설정이 저장되었습니다!');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header">
          <div>
            <h2>⚙️ 설정</h2>
            <p className="modal-subtitle">API 키 및 앱 설정</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            🎨 테마
          </button>
          <button
            className={`settings-tab ${activeTab === 'gemini' ? 'active' : ''}`}
            onClick={() => setActiveTab('gemini')}
          >
            🤖 Gemini AI
          </button>
          <button
            className={`settings-tab ${activeTab === 'firebase' ? 'active' : ''}`}
            onClick={() => setActiveTab('firebase')}
          >
            🔥 Firebase
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="settings-content">
          {loading ? (
            <div className="settings-loading">로딩 중...</div>
          ) : (
            <>
              {/* 테마 설정 */}
              {activeTab === 'appearance' && (
                <div className="settings-section">
                  <h3>🎨 테마 설정</h3>
                  <p className="section-description">
                    다양한 색감 테마를 선택하여 나만의 작업 환경을 만들어보세요.
                  </p>

                  <div className="form-group">
                    <label htmlFor="theme-select">테마 선택</label>
                    <select
                      id="theme-select"
                      className="form-input"
                      value={currentTheme}
                      onChange={(e) => handleThemeChange(e.target.value)}
                    >
                      <option value="">Indigo (기본)</option>
                      <option value="ocean">🌊 Ocean - 차분하고 집중력 향상</option>
                      <option value="forest">🌲 Forest - 편안하고 자연스러운</option>
                      <option value="sunset">🌅 Sunset - 따뜻하고 활력적인</option>
                      <option value="purple">💜 Purple Dream - 창의적이고 우아한</option>
                      <option value="rose">🌸 Rose Gold - 세련되고 모던한</option>
                      <option value="midnight">🌃 Midnight - 깊고 프로페셔널한</option>
                      <option value="cyberpunk">⚡ Cyberpunk - 네온과 미래적인</option>
                      <option value="mocha">☕ Mocha - 부드럽고 눈에 편안한</option>
                    </select>
                  </div>

                  <div className="theme-preview">
                    <h4>미리보기</h4>
                    <div className="preview-colors">
                      <div className="preview-color-item">
                        <div className="preview-color" style={{
                          background: 'var(--color-primary)'
                        }}></div>
                        <span>Primary</span>
                      </div>
                      <div className="preview-color-item">
                        <div className="preview-color" style={{
                          background: 'var(--color-bg-surface)'
                        }}></div>
                        <span>Surface</span>
                      </div>
                      <div className="preview-color-item">
                        <div className="preview-color" style={{
                          background: 'var(--color-bg-elevated)'
                        }}></div>
                        <span>Elevated</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-box">
                    <strong>💡 팁:</strong> 테마는 즉시 적용되며, 자동으로 저장됩니다.
                    작업 환경에 맞는 테마를 선택하여 눈의 피로를 줄이고 집중력을 높여보세요!
                  </div>

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h3>👧 와이푸 모드 설정</h3>
                  <p className="section-description">
                    와이푸 이미지 표시 방식을 선택할 수 있습니다.
                  </p>

                  <div className="form-group">
                    <label htmlFor="waifu-mode-select">모드 선택</label>
                    <select
                      id="waifu-mode-select"
                      className="form-input"
                      value={settings.waifuMode}
                      onChange={(e) =>
                        setSettings({ ...settings, waifuMode: e.target.value as 'normal' | 'characteristic' })
                      }
                    >
                      <option value="characteristic">특성 모드 (호감도에 따라 변화)</option>
                      <option value="normal">일반 모드 (기본 이미지 고정)</option>
                    </select>
                    <small className="form-hint">
                      {settings.waifuMode === 'characteristic'
                        ? '호감도에 따라 다양한 표정의 이미지가 표시됩니다.'
                        : '호감도와 관계없이 기본 이미지만 표시됩니다.'}
                    </small>
                  </div>

                  <div className="info-box">
                    <strong>💡 참고:</strong> 설정은 로컬 저장소에 저장되어 페이지를 새로고침해도 유지됩니다.
                  </div>
                </div>
              )}

              {/* Gemini 설정 */}
              {activeTab === 'gemini' && (
                <div className="settings-section">
                  <h3>Gemini AI 설정</h3>
                  <p className="section-description">
                    Google Gemini API를 사용하여 AI 챗봇 기능을 이용할 수 있습니다.
                  </p>

                  <div className="form-group">
                    <label htmlFor="gemini-api-key">
                      Gemini API 키 <span className="required">*</span>
                    </label>
                    <input
                      id="gemini-api-key"
                      type="password"
                      className="form-input"
                      placeholder="AIzaSy..."
                      value={settings.geminiApiKey}
                      onChange={(e) =>
                        setSettings({ ...settings, geminiApiKey: e.target.value })
                      }
                    />
                    <small className="form-hint">
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        API 키 발급받기 →
                      </a>
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="insight-interval">
                      💡 인사이트 자동 갱신 주기 (분)
                    </label>
                    <input
                      id="insight-interval"
                      type="number"
                      className="form-input"
                      placeholder="15"
                      min="5"
                      max="120"
                      value={settings.autoMessageInterval || 15}
                      onChange={(e) =>
                        setSettings({ ...settings, autoMessageInterval: parseInt(e.target.value) || 15 })
                      }
                    />
                    <small className="form-hint">
                      오늘의 인사이트 패널이 자동으로 갱신되는 주기입니다. (최소 5분, 최대 120분)
                    </small>
                  </div>

                  <div className="info-box">
                    <strong>💡 참고:</strong> Gemini API 키가 없어도 앱의 다른 기능은 정상적으로
                    사용할 수 있습니다. AI 챗봇 및 인사이트 기능만 제한됩니다.
                  </div>
                </div>
              )}

              {/* Firebase 설정 */}
              {activeTab === 'firebase' && (
                <div className="settings-section">
                  <h3>Firebase 설정</h3>
                  <p className="section-description">
                    Firebase Realtime Database를 사용하여 다중 장치 간 데이터를 동기화할 수
                    있습니다.
                  </p>

                  <div className="form-group">
                    <label htmlFor="firebase-api-key">API Key</label>
                    <input
                      id="firebase-api-key"
                      type="password"
                      className="form-input"
                      placeholder="AIzaSy..."
                      value={settings.firebaseConfig?.apiKey || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            apiKey: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-auth-domain">Auth Domain</label>
                    <input
                      id="firebase-auth-domain"
                      type="text"
                      className="form-input"
                      placeholder="your-app.firebaseapp.com"
                      value={settings.firebaseConfig?.authDomain || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            authDomain: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-database-url">Database URL</label>
                    <input
                      id="firebase-database-url"
                      type="text"
                      className="form-input"
                      placeholder="https://your-app.firebaseio.com"
                      value={settings.firebaseConfig?.databaseURL || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            databaseURL: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-project-id">Project ID</label>
                    <input
                      id="firebase-project-id"
                      type="text"
                      className="form-input"
                      placeholder="your-app"
                      value={settings.firebaseConfig?.projectId || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            projectId: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-storage-bucket">Storage Bucket</label>
                    <input
                      id="firebase-storage-bucket"
                      type="text"
                      className="form-input"
                      placeholder="your-app.appspot.com"
                      value={settings.firebaseConfig?.storageBucket || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            storageBucket: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-messaging-sender-id">Messaging Sender ID</label>
                    <input
                      id="firebase-messaging-sender-id"
                      type="text"
                      className="form-input"
                      placeholder="123456789012"
                      value={settings.firebaseConfig?.messagingSenderId || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            messagingSenderId: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="firebase-app-id">App ID</label>
                    <input
                      id="firebase-app-id"
                      type="text"
                      className="form-input"
                      placeholder="1:123456789012:web:abc123def456"
                      value={settings.firebaseConfig?.appId || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          firebaseConfig: {
                            ...settings.firebaseConfig!,
                            appId: e.target.value,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="info-box">
                    <strong>💡 참고:</strong> Firebase 설정이 없어도 앱은 로컬 저장소(IndexedDB)를
                    사용하여 정상적으로 동작합니다. 다중 장치 동기화 기능만 제한됩니다.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 버튼 */}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

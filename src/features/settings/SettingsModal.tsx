/**
 * 설정 모달 - Gemini 및 Firebase API 설정
 */

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '@/data/repositories/settingsRepository';
import type { Settings } from '@/shared/types/domain';
import './settings.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    geminiApiKey: '',
    autoMessageInterval: 30,
    autoMessageEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'gemini' | 'firebase'>('gemini');

  // 설정 로드
  useEffect(() => {
    if (isOpen) {
      loadSettingsData();
    }
  }, [isOpen]);

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

  // 설정 저장
  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSettings(settings);
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

                  <div className="info-box">
                    <strong>💡 참고:</strong> Gemini API 키가 없어도 앱의 다른 기능은 정상적으로
                    사용할 수 있습니다. AI 챗봇 기능만 제한됩니다.
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

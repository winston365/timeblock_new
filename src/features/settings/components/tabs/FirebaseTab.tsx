/**
 * FirebaseTab
 *
 * @role Firebase 및 Bark API 설정 관리 탭
 * @input FirebaseTabProps (localSettings, setLocalSettings)
 * @output Firebase 설정 입력 폼 UI 렌더링
 * @external_dependencies 없음 (순수 UI 컴포넌트)
 */

import type { FirebaseTabProps, Settings } from './types';
import { sectionClass, sectionDescriptionClass, formGroupClass, inputClass, infoBoxClass } from './styles';

/**
 * Firebase 및 Bark API 설정을 관리하는 탭 컴포넌트입니다.
 * @param props - 탭 props
 * @param props.localSettings - 현재 로컬 설정 상태
 * @param props.setLocalSettings - 로컬 설정 상태 업데이트 함수
 * @returns Firebase 설정 입력 폼 UI
 */
export function FirebaseTab({ localSettings, setLocalSettings }: FirebaseTabProps) {
    /**
     * Firebase 설정의 개별 필드를 업데이트합니다.
     * @param configKey - Firebase 설정 필드명
     * @param configValue - 업데이트할 값
     */
    const updateFirebaseConfig = (configKey: string, configValue: string) => {
        setLocalSettings((prev: Settings | null) => {
            if (!prev) return prev;
            const currentConfig = prev.firebaseConfig || {
                apiKey: '',
                authDomain: '',
                databaseURL: '',
                projectId: '',
                storageBucket: '',
                messagingSenderId: '',
                appId: ''
            };
            return {
                ...prev,
                firebaseConfig: {
                    ...currentConfig,
                    [configKey]: configValue,
                },
            };
        });
    };

    return (
        <>
            {/* Bark API Section */}
            <div className={sectionClass}>
                <h3>🔥 Firebase 설정</h3>
                <p className={sectionDescriptionClass}>
                    데이터 동기화 및 백업을 위한 Firebase 설정입니다.
                </p>

                <div className={formGroupClass}>
                    <label htmlFor="bark-api-key">
                        🔔 Bark API 키 (알림용)
                    </label>
                    <input
                        id="bark-api-key"
                        type="password"
                        className={inputClass}
                        placeholder="Bark 앱의 Key 입력"
                        value={localSettings?.barkApiKey || ''}
                        onChange={(e) =>
                            setLocalSettings((prev: Settings | null) => prev ? ({ ...prev, barkApiKey: e.target.value }) : prev)
                        }
                    />
                    <small className="text-[0.75rem] text-[var(--color-text-tertiary)]">
                        <a
                            href="https://apps.apple.com/us/app/bark-customed-notifications/id1403753865"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Bark 앱 설치 및 키 확인 →
                        </a>
                    </small>
                </div>

                <div className="my-4 border-t border-[var(--color-border)]" />
            </div>

            {/* Firebase Config Section */}
            <div className={sectionClass}>
                <h3>Firebase 설정</h3>
                <p className="section-description">
                    Firebase Realtime Database를 사용하여 다중 장치 간 데이터를 동기화할 수
                    있습니다.
                </p>

                <div className={formGroupClass}>
                    <label htmlFor="firebase-api-key">API Key</label>
                    <input
                        id="firebase-api-key"
                        type="password"
                        className={inputClass}
                        placeholder="AIzaSy..."
                        value={localSettings?.firebaseConfig?.apiKey || ''}
                        onChange={(e) => updateFirebaseConfig('apiKey', e.target.value)}
                    />
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="firebase-auth-domain">Auth Domain</label>
                    <input
                        id="firebase-auth-domain"
                        type="text"
                        className={inputClass}
                        placeholder="your-app.firebaseapp.com"
                        value={localSettings?.firebaseConfig?.authDomain || ''}
                        onChange={(e) => updateFirebaseConfig('authDomain', e.target.value)}
                    />
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="firebase-database-url">Database URL</label>
                    <input
                        id="firebase-database-url"
                        type="text"
                        className={inputClass}
                        placeholder="https://your-app.firebaseio.com"
                        value={localSettings?.firebaseConfig?.databaseURL || ''}
                        onChange={(e) => updateFirebaseConfig('databaseURL', e.target.value)}
                    />
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="firebase-project-id">Project ID</label>
                    <input
                        id="firebase-project-id"
                        type="text"
                        className={inputClass}
                        placeholder="your-app"
                        value={localSettings?.firebaseConfig?.projectId || ''}
                        onChange={(e) => updateFirebaseConfig('projectId', e.target.value)}
                    />
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="firebase-storage-bucket">Storage Bucket</label>
                    <input
                        id="firebase-storage-bucket"
                        type="text"
                        className={inputClass}
                        placeholder="your-app.appspot.com"
                        value={localSettings?.firebaseConfig?.storageBucket || ''}
                        onChange={(e) => updateFirebaseConfig('storageBucket', e.target.value)}
                    />
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="firebase-messaging-sender-id">Messaging Sender ID</label>
                    <input
                        id="firebase-messaging-sender-id"
                        type="text"
                        className={inputClass}
                        placeholder="123456789012"
                        value={localSettings?.firebaseConfig?.messagingSenderId || ''}
                        onChange={(e) => updateFirebaseConfig('messagingSenderId', e.target.value)}
                    />
                </div>

                <div className={formGroupClass}>
                    <label htmlFor="firebase-app-id">App ID</label>
                    <input
                        id="firebase-app-id"
                        type="text"
                        className={inputClass}
                        placeholder="1:123456789012:web:abc123def456"
                        value={localSettings?.firebaseConfig?.appId || ''}
                        onChange={(e) => updateFirebaseConfig('appId', e.target.value)}
                    />
                </div>

                <div className={infoBoxClass}>
                    <strong>💡 참고:</strong> Firebase 설정이 없어도 앱은 로컬 저장소(IndexedDB)를
                    사용하여 정상적으로 동작합니다. 다중 장치 동기화 기능만 제한됩니다.
                </div>
            </div>
        </>
    );
}

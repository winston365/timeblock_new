/**
 * ShopModal
 *
 * @role 상점 아이템을 추가하거나 편집하는 모달 컴포넌트
 * @input item (ShopItem | null), onClose (function)
 * @output 아이템 이름, 가격, 이미지 업로드 입력 필드 및 저장 버튼을 포함한 모달 UI
 * @external_dependencies
 *   - createShopItem, updateShopItem: 상점 아이템 Repository
 */

import { useState, useEffect } from 'react';
import type { ShopItem } from '@/shared/types/domain';
import { createShopItem, updateShopItem } from '@/data/repositories';
import { toast } from 'react-hot-toast';

interface ShopModalProps {
    item: ShopItem | null; // null이면 신규 생성
    onClose: (saved: boolean) => void;
}

/**
 * 상점 아이템 추가/편집 모달 컴포넌트
 *
 * @param {ShopModalProps} props - item, onClose를 포함하는 props
 * @returns {JSX.Element} 모달 UI
 * @sideEffects
 *   - ESC 키로 모달 닫기
 *   - 이미지 파일을 Base64로 변환하여 저장
 *   - 저장 시 Firebase 동기화
 */
export function ShopModal({ item, onClose }: ShopModalProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState(50);
    const [image, setImage] = useState<string | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);

    // 편집 모드일 경우 초기값 설정
    useEffect(() => {
        if (item) {
            setName(item.name);
            setPrice(item.price);
            setImage(item.image);
        }
    }, [item]);

    // ESC 키로 모달 닫기, Ctrl+Enter로 저장
    useEffect(() => {
        const handleKeyboard = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose(false);
            }
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                // 폼 제출 트리거
                const form = document.querySelector('.modal-body') as HTMLFormElement;
                if (form) {
                    form.requestSubmit();
                }
            }
        };
        window.addEventListener('keydown', handleKeyboard);
        return () => window.removeEventListener('keydown', handleKeyboard);
    }, [onClose]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 이미지 파일 검증
        if (!file.type.startsWith('image/')) {
            toast.error('이미지 파일만 업로드할 수 있습니다.');
            return;
        }

        // 파일 크기 제한 (2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('이미지 크기는 2MB 이하여야 합니다.');
            return;
        }

        // Base64로 변환
        const reader = new FileReader();
        reader.onload = () => {
            setImage(reader.result as string);
        };
        reader.onerror = () => {
            toast.error('이미지 로드에 실패했습니다.');
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setImage(undefined);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('상품 이름을 입력해주세요.');
            return;
        }

        if (price <= 0) {
            toast.error('가격은 1 이상이어야 합니다.');
            return;
        }

        setIsSaving(true);

        try {
            if (item) {
                // 수정
                await updateShopItem(item.id, {
                    name: name.trim(),
                    price,
                    image,
                });
            } else {
                // 신규 생성
                await createShopItem(
                    name.trim(),
                    price,
                    image
                );
            }

            onClose(true);
        } catch (error) {
            console.error('Failed to save shop item:', error);
            toast.error('상품 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        onClose(false);
    };

    return (
        <div className="modal-overlay fixed inset-0 z-[1000] flex items-start justify-center bg-[color:var(--modal-backdrop)] px-4 py-8 backdrop-blur-sm md:items-center" onClick={handleCancel}>
            <div className="modal-content relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--modal-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-[var(--modal-shadow)]" onClick={e => e.stopPropagation()}>
                <div className="modal-header flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-4">
                    <h2>{item ? '상품 편집' : '상품 추가'}</h2>
                    <button
                        className="modal-close inline-flex h-10 w-10 items-center justify-center rounded-full text-xl text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60"
                        onClick={handleCancel}
                        aria-label="닫기"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body flex flex-col gap-5 overflow-y-auto px-6 py-6">
                    {/* 상품 이름 */}
                    <div className="form-group flex flex-col gap-2 text-sm text-[var(--color-text)]">
                        <label htmlFor="shop-name">
                            상품 이름 <span className="required text-[var(--color-danger,#ef4444)]">*</span>
                        </label>
                        <input
                            id="shop-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="예: 아이스크림 🍦"
                            required
                            autoFocus
                        />
                    </div>

                    {/* 가격 */}
                    <div className="form-group flex flex-col gap-2 text-sm text-[var(--color-text)]">
                        <label htmlFor="shop-price">
                            가격 (XP) <span className="required text-[var(--color-danger,#ef4444)]">*</span>
                        </label>
                        <input
                            id="shop-price"
                            type="number"
                            value={price}
                            onChange={e => setPrice(Number(e.target.value))}
                            min={1}
                            max={10000}
                            required
                        />
                    </div>

                    {/* 이미지 업로드 */}
                    <div className="form-group flex flex-col gap-2 text-sm text-[var(--color-text)]">
                        <label htmlFor="shop-image">상품 이미지 (선택)</label>

                        {image ? (
                            <div className="shop-image-preview mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40 p-4">
                                <img src={image} alt="상품 이미지" />
                                <button
                                    type="button"
                                    className="btn-remove-image inline-flex items-center justify-center rounded-full bg-[var(--color-danger,#ef4444)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger,#ef4444)]/60"
                                    onClick={handleRemoveImage}
                                >
                                    이미지 제거
                                </button>
                            </div>
                        ) : (
                            <input
                                id="shop-image"
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        )}

                        <p className="form-hint text-xs text-[var(--color-text-tertiary)]">
                            권장 크기: 200x200px, 최대 2MB
                        </p>
                    </div>

                    {/* 버튼 */}
                    <div className="modal-actions mt-2 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            className="btn-secondary inline-flex items-center justify-center rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 disabled:opacity-50"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="btn-primary inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong,#7c3aed)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--color-primary)]/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60 disabled:opacity-50"
                            disabled={isSaving}
                        >
                            {isSaving ? '저장 중...' : item ? '수정' : '추가'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


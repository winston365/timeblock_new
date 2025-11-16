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
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 제한 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('이미지 크기는 2MB 이하여야 합니다.');
      return;
    }

    // Base64로 변환
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
    };
    reader.onerror = () => {
      alert('이미지 로드에 실패했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImage(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('상품 이름을 입력해주세요.');
      return;
    }

    if (price <= 0) {
      alert('가격은 1 이상이어야 합니다.');
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
      alert('상품 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onClose(false);
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? '상품 편집' : '상품 추가'}</h2>
          <button
            className="modal-close"
            onClick={handleCancel}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* 상품 이름 */}
          <div className="form-group">
            <label htmlFor="shop-name">
              상품 이름 <span className="required">*</span>
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
          <div className="form-group">
            <label htmlFor="shop-price">
              가격 (XP) <span className="required">*</span>
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
          <div className="form-group">
            <label htmlFor="shop-image">상품 이미지 (선택)</label>

            {image ? (
              <div className="shop-image-preview">
                <img src={image} alt="상품 이미지" />
                <button
                  type="button"
                  className="btn-remove-image"
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

            <p className="form-hint">
              권장 크기: 200x200px, 최대 2MB
            </p>
          </div>

          {/* 버튼 */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isSaving}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
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

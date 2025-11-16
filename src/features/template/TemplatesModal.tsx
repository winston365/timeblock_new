/**
 * TemplatesModal - 템플릿 관리 전체 화면 모달
 *
 * @role 반복 작업 템플릿을 관리하고 오늘 할 일로 추가하는 전체 화면 모달 컴포넌트
 * @input isOpen (모달 표시 여부), onClose (모달 닫기 핸들러), onTaskCreate (템플릿에서 작업 생성 시 콜백)
 * @output 템플릿 목록, 자동 생성 배지, 추가/편집/삭제 버튼을 포함한 모달 UI
 * @external_dependencies
 *   - loadTemplates, deleteTemplate: 템플릿 Repository
 *   - TemplateModal: 템플릿 추가/편집 모달 컴포넌트
 *   - RESISTANCE_LABELS, TIME_BLOCKS: 도메인 타입 및 상수
 */

import { useState, useEffect } from 'react';
import type { Template } from '@/shared/types/domain';
import { loadTemplates, deleteTemplate as deleteTemplateRepo } from '@/data/repositories';
import { TemplateModal } from './TemplateModal';
import { RESISTANCE_LABELS, TIME_BLOCKS } from '@/shared/types/domain';
import './templatesModal.css';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreate: (template: Template) => void;
}

/**
 * 템플릿 관리 전체 화면 모달 컴포넌트
 *
 * @param {TemplatesModalProps} props - 모달 props
 * @returns {JSX.Element | null} 템플릿 모달 UI 또는 null
 * @sideEffects
 *   - 컴포넌트 마운트 시 템플릿 목록 로드
 *   - 템플릿 추가/수정/삭제 시 Firebase 동기화
 *   - "오늘 추가" 버튼 클릭 시 onTaskCreate 콜백 호출
 */
export default function TemplatesModal({ isOpen, onClose, onTaskCreate }: TemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isTemplateModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isTemplateModalOpen, onClose]);

  // 템플릿 로드
  useEffect(() => {
    if (isOpen) {
      loadTemplatesData();
    }
  }, [isOpen]);

  const loadTemplatesData = async () => {
    const data = await loadTemplates();
    setTemplates(data);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateModalOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsTemplateModalOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    try {
      // Optimistic UI 업데이트: 즉시 목록에서 제거
      setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== id));

      // 백그라운드에서 DB 업데이트
      await deleteTemplateRepo(id);
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('템플릿 삭제에 실패했습니다.');
      // 에러 발생 시 목록 새로고침으로 복원
      await loadTemplatesData();
    }
  };

  const handleTemplateModalClose = async (saved: boolean) => {
    setIsTemplateModalOpen(false);
    setEditingTemplate(null);

    // 저장 시에만 목록 새로고침 (추가/수정된 템플릿 반영)
    if (saved) {
      await loadTemplatesData();
    }
  };

  const handleAddToToday = (template: Template) => {
    onTaskCreate(template);
  };

  const getTimeBlockLabel = (blockId: string | null): string => {
    if (!blockId) return '나중에';
    const block = TIME_BLOCKS.find(b => b.id === blockId);
    return block ? block.label : '나중에';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay templates-modal-overlay" onClick={onClose}>
      <div className="modal-content templates-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="modal-header templates-modal-header">
          <div>
            <h2>📝 템플릿 관리</h2>
            <p className="modal-subtitle">반복 작업을 템플릿으로 저장하고 관리하세요</p>
          </div>
          <div className="templates-modal-header-actions">
            <button
              className="btn-add-template-primary"
              onClick={handleAddTemplate}
              title="새 템플릿 추가"
            >
              + 템플릿 추가
            </button>
            <button className="btn-close" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          </div>
        </div>

        {/* 템플릿 목록 */}
        <div className="templates-modal-body">
          {templates.length === 0 ? (
            <div className="templates-empty-state">
              <div className="templates-empty-icon">📝</div>
              <h3>등록된 템플릿이 없습니다</h3>
              <p>반복적으로 수행하는 작업을 템플릿으로 저장하여<br />빠르게 할 일에 추가할 수 있습니다.</p>
              <button className="btn-add-template-empty" onClick={handleAddTemplate}>
                첫 템플릿 만들기
              </button>
            </div>
          ) : (
            <div className="templates-grid">
              {templates.map(template => (
                <div key={template.id} className="template-card">
                  {/* 카드 헤더 */}
                  <div className="template-card-header">
                    <div className="template-card-title">
                      <h3>{template.name}</h3>
                      {template.autoGenerate && (
                        <span className="template-card-badge" title="매일 자동 생성">
                          🔄 자동
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 카드 바디 */}
                  <div className="template-card-body">
                    <p className="template-card-text">{template.text}</p>
                    {template.memo && (
                      <div className="template-card-memo">
                        <span className="template-card-memo-icon">💭</span>
                        <span>{template.memo}</span>
                      </div>
                    )}

                    {/* 메타 정보 */}
                    <div className="template-card-meta">
                      <div className="template-meta-item">
                        <span className="template-meta-icon">⏱️</span>
                        <span>{template.baseDuration}분</span>
                      </div>
                      <div className="template-meta-item">
                        <span className="template-meta-icon">🎯</span>
                        <span>{RESISTANCE_LABELS[template.resistance]}</span>
                      </div>
                      <div className="template-meta-item">
                        <span className="template-meta-icon">📍</span>
                        <span>{getTimeBlockLabel(template.timeBlock)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 카드 액션 */}
                  <div className="template-card-actions">
                    <button
                      className="btn-template-card-add"
                      onClick={() => handleAddToToday(template)}
                      title="오늘 할 일로 추가"
                    >
                      <span>+</span> 오늘 추가
                    </button>
                    <div className="template-card-secondary-actions">
                      <button
                        className="btn-template-card-edit"
                        onClick={() => handleEditTemplate(template)}
                        title="템플릿 편집"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-template-card-delete"
                        onClick={() => handleDeleteTemplate(template.id)}
                        title="템플릿 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="modal-actions templates-modal-footer">
          <div className="templates-modal-footer-info">
            총 {templates.length}개의 템플릿
          </div>
          <button className="btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>

      {/* 템플릿 추가/편집 모달 */}
      {isTemplateModalOpen && (
        <TemplateModal
          template={editingTemplate}
          onClose={handleTemplateModalClose}
        />
      )}
    </div>
  );
}

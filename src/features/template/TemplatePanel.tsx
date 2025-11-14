/**
 * TemplatePanel - 템플릿 목록 및 관리
 */

import { useState, useEffect } from 'react';
import type { Template } from '@/shared/types/domain';
import { loadTemplates, deleteTemplate } from '@/data/repositories';
import { TemplateModal } from './TemplateModal';
import { RESISTANCE_LABELS, TIME_BLOCKS } from '@/shared/types/domain';
import './template.css';

interface TemplatePanelProps {
  onTaskCreate: (template: Template) => void;
}

export default function TemplatePanel({ onTaskCreate }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // 템플릿 로드
  useEffect(() => {
    loadTemplatesData();
  }, []);

  const loadTemplatesData = async () => {
    const data = await loadTemplates();
    setTemplates(data);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    try {
      await deleteTemplate(id);
      await loadTemplatesData();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('템플릿 삭제에 실패했습니다.');
    }
  };

  const handleModalClose = async (saved: boolean) => {
    setIsModalOpen(false);
    setEditingTemplate(null);

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

  return (
    <div className="template-panel">
      <div className="template-header">
        <h3>📝 템플릿</h3>
        <button
          className="btn-add-template"
          onClick={handleAddTemplate}
          title="템플릿 추가"
        >
          + 추가
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="template-empty">
          <p>등록된 템플릿이 없습니다.</p>
          <p className="template-hint">반복 작업을 템플릿으로 저장하세요!</p>
        </div>
      ) : (
        <div className="template-list">
          {templates.map(template => (
            <div key={template.id} className="template-item">
              <div className="template-item-header">
                <strong className="template-name">{template.name}</strong>
                {template.autoGenerate && (
                  <span className="template-auto-badge" title="매일 자동 생성">
                    🔄
                  </span>
                )}
              </div>

              <div className="template-item-body">
                <p className="template-text">{template.text}</p>
                {template.memo && (
                  <p className="template-memo">💭 {template.memo}</p>
                )}

                <div className="template-details">
                  <span className="template-duration">
                    ⏱️ {template.baseDuration}분
                  </span>
                  <span className="template-resistance">
                    {RESISTANCE_LABELS[template.resistance]}
                  </span>
                  <span className="template-timeblock">
                    📍 {getTimeBlockLabel(template.timeBlock)}
                  </span>
                </div>
              </div>

              <div className="template-item-actions">
                <button
                  className="btn-template-add-today"
                  onClick={() => handleAddToToday(template)}
                  title="오늘 할 일로 추가"
                >
                  오늘 추가
                </button>
                <button
                  className="btn-template-edit"
                  onClick={() => handleEditTemplate(template)}
                  title="템플릿 편집"
                >
                  ✏️
                </button>
                <button
                  className="btn-template-delete"
                  onClick={() => handleDeleteTemplate(template.id)}
                  title="템플릿 삭제"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <TemplateModal
          template={editingTemplate}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}

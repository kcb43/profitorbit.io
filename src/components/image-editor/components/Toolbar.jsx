import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Save, X, RotateCcw, Layers, BookmarkPlus, FolderOpen, Trash2, Loader2,
} from 'lucide-react';

export default function Toolbar({
  canResetAll,
  canApplyToAll,
  hasMultiple,
  isProcessing,
  isDark,
  onSave,
  onResetAll,
  onApplyToAll,
  onClose,
  // Template props
  templates,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  showSaveDialog,
  setShowSaveDialog,
  templateName,
  setTemplateName,
}) {
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const loadBtnRef = useRef(null);

  // Position template menu below button
  useEffect(() => {
    if (!showTemplateMenu || !loadBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const r = loadBtnRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
  }, [showTemplateMenu]);

  // Close template menu on outside click
  useEffect(() => {
    if (!showTemplateMenu) return;
    const handler = (e) => {
      if (!e.target.closest('[data-template-menu]')) setShowTemplateMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplateMenu]);

  const barBg = isDark ? '#111111' : '#f0f0f0';
  const barBorder = isDark ? '#262626' : '#d4d4d4';
  const btnBase = isDark
    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-600'
    : 'bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300';
  const btnSmall = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors';

  return (
    <div
      className="flex items-center px-4 flex-shrink-0"
      style={{
        height: 56,
        background: barBg,
        borderBottom: `1px solid ${barBorder}`,
      }}
    >
      {/* Left: Save  — flex-1 so center group stays truly centred */}
      <div className="flex items-center gap-2 flex-1">
        <button
          onClick={onSave}
          disabled={isProcessing}
          className={`${btnSmall} bg-blue-600 hover:bg-blue-700 text-white border-0`}
        >
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      {/* Center: Action buttons — no absolute positioning, flex siblings balance it */}
      <div className="flex items-center gap-2 justify-center">
        {/* Save Template */}
        {showSaveDialog ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSaveTemplate()}
              placeholder="Template name..."
              className="text-xs px-2 py-1.5 rounded border w-32"
              style={{
                background: isDark ? '#262626' : '#fff',
                color: isDark ? '#e5e5e5' : '#171717',
                borderColor: isDark ? '#404040' : '#d4d4d4',
              }}
              autoFocus
            />
            <button onClick={onSaveTemplate} className={`${btnSmall} ${btnBase}`}>
              Save
            </button>
            <button onClick={() => setShowSaveDialog(false)} className={`${btnSmall} ${btnBase}`}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveDialog(true)}
            className={`${btnSmall} ${btnBase}`}
          >
            <BookmarkPlus size={14} />
            Save Template
          </button>
        )}

        {/* Load Template */}
        <button
          ref={loadBtnRef}
          onClick={() => setShowTemplateMenu(!showTemplateMenu)}
          className={`${btnSmall} ${btnBase}`}
          data-template-menu
        >
          <FolderOpen size={14} />
          Load
        </button>

        {/* Apply to All */}
        {hasMultiple && (
          <button
            onClick={onApplyToAll}
            disabled={isProcessing || !canApplyToAll}
            className={`${btnSmall} ${btnBase}`}
            style={{ opacity: canApplyToAll ? 1 : 0.5 }}
          >
            <Layers size={14} />
            Apply to All
          </button>
        )}

        {/* Reset All */}
        {canResetAll && (
          <button
            onClick={onResetAll}
            className={`${btnSmall} text-red-400 border border-red-400/30 hover:bg-red-500/10`}
          >
            <RotateCcw size={14} />
            Reset All
          </button>
        )}
      </div>

      {/* Right: Close — flex-1 + justify-end to mirror left side */}
      <div className="flex items-center justify-end flex-1">
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors hover:bg-neutral-700/50"
          style={{ color: isDark ? '#a3a3a3' : '#525252' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Template menu portal */}
      {showTemplateMenu &&
        menuPos &&
        createPortal(
          <div
            data-template-menu
            className="fixed z-[9999] rounded-lg shadow-xl overflow-hidden"
            style={{
              top: menuPos.top,
              right: menuPos.right,
              background: isDark ? '#1a1a1a' : '#ffffff',
              border: `1px solid ${isDark ? '#333' : '#d4d4d4'}`,
              minWidth: 200,
              maxHeight: 300,
              overflowY: 'auto',
            }}
          >
            {templates.length === 0 ? (
              <div className="px-4 py-3 text-xs" style={{ color: isDark ? '#737373' : '#a3a3a3' }}>
                No saved templates
              </div>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors"
                  style={{
                    color: isDark ? '#e5e5e5' : '#171717',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark ? '#262626' : '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => {
                    onLoadTemplate(tpl);
                    setShowTemplateMenu(false);
                  }}
                >
                  <span className="text-xs">{tpl.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTemplate(tpl.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/20 transition-colors"
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

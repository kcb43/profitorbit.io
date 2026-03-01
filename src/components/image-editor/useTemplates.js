import { useState, useCallback } from 'react';
import { loadTemplates, persistTemplates, createTemplate } from './utils/templateHelpers';

export function useTemplates() {
  const [templates, setTemplates] = useState(loadTemplates);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const saveTemplate = useCallback(
    (imageState) => {
      if (!templateName.trim() || !imageState) return;
      const tpl = createTemplate(templateName, imageState);
      setTemplates((prev) => {
        const next = [tpl, ...prev];
        persistTemplates(next);
        return next;
      });
      setTemplateName('');
      setShowSaveDialog(false);
      return tpl;
    },
    [templateName]
  );

  const deleteTemplate = useCallback((id) => {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      persistTemplates(next);
      return next;
    });
  }, []);

  return {
    templates,
    showSaveDialog,
    setShowSaveDialog,
    showLoadMenu,
    setShowLoadMenu,
    templateName,
    setTemplateName,
    saveTemplate,
    deleteTemplate,
  };
}

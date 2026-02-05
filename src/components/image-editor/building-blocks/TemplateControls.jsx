import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Save, X } from 'lucide-react';

/**
 * TemplateControls - Template selector dropdown and save button
 */
export function TemplateControls({ 
  templates = [], 
  selectedTemplate, 
  onTemplateChange,
  onSaveTemplate,
  onDeleteTemplate,
  onResetTemplate,
  className = ''
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Select
        value={selectedTemplate || 'none'}
        onValueChange={(value) => {
          if (value === 'none') {
            onResetTemplate();
          } else {
            const template = templates.find(t => t.id === value);
            if (template) {
              onTemplateChange(template);
            }
          }
        }}
      >
        <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900 text-xs h-7">
          <SelectValue placeholder="Template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None (Custom)</SelectItem>
          {templates.map((template) => (
            <SelectItem 
              key={template.id} 
              value={template.id}
              className="group relative"
            >
              <div className="flex items-center justify-between w-full gap-2 pr-6">
                <span className="flex-1 truncate">{template.name}</span>
                <button
                  onClick={(e) => onDeleteTemplate(template.id, template.name, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded flex items-center justify-center flex-shrink-0 z-10"
                  title="Delete template"
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </button>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={onSaveTemplate}
        className="w-full bg-indigo-600/80 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 text-xs h-7 sm:h-[41px]"
      >
        <Save className="w-3 h-3" />
        <span>Save Template</span>
      </Button>
    </div>
  );
}

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Rich text textarea that preserves formatting (bold, line breaks) when pasting
 */
export function RichTextarea({ 
  value = '', 
  onChange, 
  className, 
  placeholder = '',
  id,
  name,
  ...props 
}) {
  const editorRef = useRef(null);
  const isUpdatingRef = useRef(false);

  // Update editor content when value prop changes (but not during user typing)
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const newHtml = value || '';
      
      // Only update if content actually changed to avoid cursor jumping
      if (currentHtml !== newHtml && editorRef.current !== document.activeElement) {
        editorRef.current.innerHTML = newHtml;
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current && onChange) {
      isUpdatingRef.current = true;
      const html = editorRef.current.innerHTML;
      onChange({ target: { value: html } });
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    
    // Get pasted data as HTML
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    
    // Use HTML if available (preserves formatting), otherwise use plain text with line breaks
    let content;
    if (html) {
      // Clean up the HTML - remove unnecessary tags but keep <b>, <strong>, <i>, <em>, <br>, <p>
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Convert line breaks to <br> tags
      content = tempDiv.innerHTML
        .replace(/<div>/gi, '<br>')
        .replace(/<\/div>/gi, '')
        .replace(/<p>/gi, '')
        .replace(/<\/p>/gi, '<br>');
    } else {
      // Plain text - convert newlines to <br>
      content = text.replace(/\n/g, '<br>');
    }
    
    // Insert at cursor position
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const fragment = range.createContextualFragment(content);
      range.insertNode(fragment);
      
      // Move cursor to end of inserted content
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    handleInput();
  };

  const handleKeyDown = (e) => {
    // Handle Enter key to insert <br> instead of <div>
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '<br><br>');
      handleInput();
    }
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      id={id}
      name={name}
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      className={cn(
        "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "min-h-[120px] overflow-auto",
        // Placeholder styling
        "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
        className
      )}
      suppressContentEditableWarning
      {...props}
    />
  );
}


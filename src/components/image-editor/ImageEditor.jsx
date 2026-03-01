import React from 'react';
import ImageEditorInner from './ImageEditorInner';

// Public API wrapper — maintains identical interface to the old ImageEditor.
// Only mounts the inner component when `open` is true to avoid unnecessary renders.
export function ImageEditor(props) {
  if (!props?.open) return null;
  return <ImageEditorInner {...props} />;
}

export default ImageEditor;

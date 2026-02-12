import React, { useState, useCallback, useMemo } from 'react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import { useToast } from '@/components/ui/use-toast';
import { uploadApi } from '@/api/uploadApi';

/**
 * Advanced Image Editor Component using Filerobot
 * Provides comprehensive image editing capabilities with filters, annotations, watermarks, and more
 *
 * @param {boolean} open - Whether the editor is open
 * @param {function} onOpenChange - Callback when editor open state changes
 * @param {string} imageSrc - Source URL of the image to edit
 * @param {function} onSave - Callback when image is saved (receives file URL and imageIndex)
 * @param {string} fileName - Default filename for saved image
 * @param {array} allImages - All images for the item (for batch operations)
 * @param {function} onApplyToAll - Callback to apply settings to all images
 * @param {string} itemId - ID of the item being edited
 * @param {function} onAddImage - Callback to add new image
 * @param {number} imageIndex - Index of the image being edited
 */
function ImageEditorInner({ 
  open, 
  onOpenChange, 
  imageSrc, 
  onSave, 
  fileName = 'edited-image.jpg',
  allImages = [],
  onApplyToAll,
  itemId,
  onAddImage,
  imageIndex = 0
}) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // Extract file name without extension for default name
  const defaultImageName = useMemo(() => {
    if (fileName) {
      return fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    }
    if (imageSrc) {
      const urlParts = imageSrc.split('/');
      const fileNameFromUrl = urlParts[urlParts.length - 1];
      return fileNameFromUrl.replace(/\.[^/.]+$/, '');
    }
    return 'edited-image';
  }, [fileName, imageSrc]);

  const handleSave = useCallback(async (editedImageObject, designState) => {
    setIsProcessing(true);
    
    try {
      console.log('🎨 Filerobot save triggered:', {
        imageBase64: editedImageObject.imageBase64?.substring(0, 100) + '...',
        fullName: editedImageObject.fullName,
        mimeType: editedImageObject.mimeType,
        quality: editedImageObject.quality,
      });

      // Convert base64 to File object
      const base64Data = editedImageObject.imageBase64;
      const mimeType = editedImageObject.mimeType || 'image/png';
      const fullName = editedImageObject.fullName || `${defaultImageName}.png`;

      // Convert base64 to blob
      const byteString = atob(base64Data.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeType });
      
      // Create File object
      const file = new File([blob], fullName, { type: mimeType });
      
      console.log('📦 Created file:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Upload the file
      const { file_url } = await uploadApi.uploadFile({ file });
      
      console.log('✅ Uploaded edited image:', file_url);

      // Call the onSave callback with the uploaded URL and imageIndex
      if (onSave) {
        await onSave(file_url, imageIndex);
      }

      toast({
        title: "Image saved successfully",
        description: "Your edited image has been saved",
      });

      // Close the editor
      if (onOpenChange) {
        onOpenChange(false);
      }

    } catch (error) {
      console.error('❌ Error saving image:', error);
      toast({
        title: "Error saving image",
        description: error.message || "Failed to save edited image",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onSave, onOpenChange, toast, defaultImageName, imageIndex]);

  const handleClose = useCallback((closingReason, haveNotSavedChanges) => {
    console.log('🔒 Editor closed:', { closingReason, haveNotSavedChanges });
    
    if (onOpenChange) {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  if (!open || !imageSrc) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <FilerobotImageEditor
        source={imageSrc}
        onSave={handleSave}
        onClose={handleClose}
        annotationsCommon={{
          fill: '#3b82f6',
          stroke: '#1d4ed8',
          strokeWidth: 2,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          shadowBlur: 0,
          opacity: 1,
        }}
        Text={{
          text: 'Add text...',
          fontFamily: 'Arial',
          fonts: [
            'Arial',
            'Helvetica',
            'Times New Roman',
            'Courier New',
            'Verdana',
            'Georgia',
            'Comic Sans MS',
            'Trebuchet MS',
            'Impact',
          ],
          fontSize: 24,
          letterSpacing: 0,
          lineHeight: 1.2,
          align: 'left',
          fontStyle: 'normal',
        }}
        Rotate={{
          angle: 90,
          componentType: 'slider',
        }}
        Crop={{
          minWidth: 50,
          minHeight: 50,
          ratio: 'original',
          presetsItems: [
            {
              titleKey: 'square',
              descriptionKey: '1:1',
              ratio: 1,
            },
            {
              titleKey: 'landscape',
              descriptionKey: '16:9',
              ratio: 16 / 9,
            },
            {
              titleKey: 'portrait',
              descriptionKey: '9:16',
              ratio: 9 / 16,
            },
            {
              titleKey: 'classicTv',
              descriptionKey: '4:3',
              ratio: 4 / 3,
            },
          ],
          presetsFolders: [
            {
              titleKey: 'socialMedia',
              groups: [
                {
                  titleKey: 'instagram',
                  items: [
                    {
                      titleKey: 'post',
                      width: 1080,
                      height: 1080,
                      descriptionKey: '1080x1080px',
                    },
                    {
                      titleKey: 'story',
                      width: 1080,
                      height: 1920,
                      descriptionKey: '1080x1920px',
                    },
                  ],
                },
                {
                  titleKey: 'facebook',
                  items: [
                    {
                      titleKey: 'profile',
                      width: 180,
                      height: 180,
                      descriptionKey: '180x180px',
                    },
                    {
                      titleKey: 'coverPhoto',
                      width: 820,
                      height: 312,
                      descriptionKey: '820x312px',
                    },
                    {
                      titleKey: 'post',
                      width: 1200,
                      height: 630,
                      descriptionKey: '1200x630px',
                    },
                  ],
                },
                {
                  titleKey: 'ebay',
                  items: [
                    {
                      titleKey: 'listing',
                      width: 1600,
                      height: 1600,
                      descriptionKey: '1600x1600px',
                    },
                    {
                      titleKey: 'square',
                      width: 1000,
                      height: 1000,
                      descriptionKey: '1000x1000px',
                    },
                  ],
                },
              ],
            },
          ],
        }}
        translations={{
          square: 'Square',
          landscape: 'Landscape',
          portrait: 'Portrait',
          classicTv: 'Classic TV',
          socialMedia: 'Social Media',
          instagram: 'Instagram',
          facebook: 'Facebook',
          ebay: 'eBay',
          post: 'Post',
          story: 'Story',
          profile: 'Profile',
          coverPhoto: 'Cover Photo',
          listing: 'Listing Photo',
        }}
        tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.RESIZE, TABS.WATERMARK]}
        defaultTabId={TABS.ADJUST}
        defaultSavedImageType="jpeg"
        defaultSavedImageQuality={0.92}
        savingPixelRatio={4}
        previewPixelRatio={window.devicePixelRatio || 2}
        theme={{
          palette: {
            'bg-primary-active': '#3b82f6',
            'accent-primary': '#3b82f6',
            'accent-primary-active': '#2563eb',
          },
          typography: {
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        }}
      />
    </div>
  );
}

// Public wrapper: do not mount the heavy editor unless open
export function ImageEditor(props) {
  if (!props?.open) return null;
  return <ImageEditorInner {...props} />;
}

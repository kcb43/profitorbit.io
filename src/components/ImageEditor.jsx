import React, { useState, useCallback, useMemo, useEffect } from 'react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import { useToast } from '@/components/ui/use-toast';
import { uploadApi } from '@/api/uploadApi';
import { inventoryApi } from '@/api/inventoryApi';

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
  const [designState, setDesignState] = useState(null);
  const [loadedDesignState, setLoadedDesignState] = useState(null);
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  // Keep isDark in sync with the site's theme class
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Inject Filerobot tab overrides into <head> so they beat styled-components
  useEffect(() => {
    if (!open) return;

    const STYLE_ID = 'fie-tab-color-overrides';
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }

    const tabText   = isDark ? '#fafafa' : '#0a0a0a';
    const tabFill   = isDark ? '#fafafa' : '#0a0a0a';

    el.textContent = `
      /* ── Filerobot tab overrides (injected by Orben ImageEditor) ── */

      /* All tabs: base color for current mode */
      .FIE_tab,
      .FIE_tabs-item {
        color: ${tabText} !important;
      }
      .FIE_tab svg, .FIE_tab svg *,
      .FIE_tabs-item svg, .FIE_tabs-item svg * {
        fill: ${tabFill} !important;
        color: ${tabFill} !important;
      }

      /* Selected tab: always white — readable on any accent bg */
      .FIE_tab[aria-selected="true"],
      .FIE_tabs-item[aria-selected="true"] {
        color: #ffffff !important;
      }
      .FIE_tab[aria-selected="true"] *,
      .FIE_tab[aria-selected="true"] svg,
      .FIE_tab[aria-selected="true"] svg *,
      .FIE_tabs-item[aria-selected="true"] *,
      .FIE_tabs-item[aria-selected="true"] svg,
      .FIE_tabs-item[aria-selected="true"] svg * {
        color: #ffffff !important;
        fill: #ffffff !important;
        stroke: #ffffff !important;
      }
    `;

    return () => {
      const existing = document.getElementById(STYLE_ID);
      if (existing) existing.remove();
    };
  }, [open, isDark]);

  // Load design state when opening editor
  useEffect(() => {
    const loadDesignState = async () => {
      if (!open || !itemId || !imageSrc) return;
      
      try {
        // Try to load saved design state from the item's metadata
        const { data: item } = await inventoryApi.get(itemId);
        
        if (item?.image_editor_state) {
          const imageStates = JSON.parse(item.image_editor_state);
          // Find design state for this specific image URL
          const stateForImage = imageStates[imageSrc];
          if (stateForImage) {
            console.log('📋 Loaded design state for image:', imageSrc);
            setLoadedDesignState(stateForImage);
          }
        }
      } catch (error) {
        console.error('Error loading design state:', error);
      }
    };

    loadDesignState();
  }, [open, itemId, imageSrc]);

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

  const handleSave = useCallback(async (editedImageObject, currentDesignState) => {
    setIsProcessing(true);
    
    try {
      console.log('🎨 Filerobot save triggered:', {
        imageBase64: editedImageObject.imageBase64?.substring(0, 100) + '...',
        fullName: editedImageObject.fullName,
        mimeType: editedImageObject.mimeType,
        quality: editedImageObject.quality,
        designState: currentDesignState,
      });

      // Store the design state
      setDesignState(currentDesignState);

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

      // Save design state to item metadata
      if (itemId && imageSrc) {
        try {
          const { data: item } = await inventoryApi.get(itemId);
          const existingStates = item?.image_editor_state ? JSON.parse(item.image_editor_state) : {};
          
          // Store design state keyed by image URL
          existingStates[imageSrc] = currentDesignState;
          
          await inventoryApi.update(itemId, {
            image_editor_state: JSON.stringify(existingStates)
          });
          
          console.log('💾 Saved design state to item metadata');
        } catch (stateError) {
          console.error('Failed to save design state:', stateError);
          // Don't block the save if this fails
        }
      }

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
  }, [onSave, onOpenChange, toast, defaultImageName, imageIndex, itemId, imageSrc]);

  const handleClose = useCallback((closingReason, haveNotSavedChanges) => {
    console.log('🔒 Editor closed:', { closingReason, haveNotSavedChanges });
    
    // Clear loaded design state
    setLoadedDesignState(null);
    
    if (onOpenChange) {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  // Hide mobile bottom nav when editor is open
  useEffect(() => {
    if (open) {
      document.body.classList.add('hide-mobile-nav');
    } else {
      document.body.classList.remove('hide-mobile-nav');
    }
    
    return () => {
      document.body.classList.remove('hide-mobile-nav');
    };
  }, [open]);

  if (!open || !imageSrc) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
        colorScheme: isDark ? 'dark' : 'light',
      }}
    >
      <FilerobotImageEditor
        source={imageSrc}
        onSave={handleSave}
        onClose={handleClose}
        observePluginContainerSize={true}
        loadableDesignState={loadedDesignState}
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
        tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.WATERMARK]}
        defaultTabId={TABS.ADJUST}
        defaultSavedImageType="jpeg"
        defaultSavedImageQuality={0.92}
        savingPixelRatio={4}
        previewPixelRatio={window.devicePixelRatio || 2}
        theme={isDark ? {
          palette: {
            // Backgrounds — match site dark mode (hsl 0 0% 3.9% ≈ #0a0a0a)
            'bg-primary':           '#0a0a0a',
            'bg-secondary':         '#171717',
            'bg-primary-active':    '#3b82f6',  // blue keeps visual clarity in active state
            'bg-secondary-active':  '#1e3a5f',
            // Accent
            'accent-primary':       '#60a5fa',  // blue-400 — lighter blue for dark bg
            'accent-primary-active':'#3b82f6',
            // Text — hsl 0 0% 98% ≈ #fafafa
            'txt-primary':          '#fafafa',
            'txt-secondary':        '#a3a3a3',  // muted-foreground dark
            'txt-primary-invert':   '#ffffff',  // white text/icons on blue active tab
            'txt-secondary-invert': '#bfdbfe',
            // Icons
            'icons-primary':        '#fafafa',
            'icons-secondary':      '#a3a3a3',
            'icons-primary-opacity-95':  'rgba(250,250,250,0.95)',
            // Borders — hsl 0 0% 14.9% ≈ #262626
            'border-primary':       '#262626',
            'border-secondary':     '#171717',
            // Misc
            'link-primary':         '#60a5fa',
            'error':                '#ef4444',
            'warning':              '#f59e0b',
            'success':              '#22c55e',
          },
          typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
        } : {
          palette: {
            // Backgrounds — match site light mode (hsl 0 0% 100% = white)
            'bg-primary':           '#ffffff',
            'bg-secondary':         '#f5f5f5',  // muted
            'bg-primary-active':    '#171717',  // near-black matches site's primary
            'bg-secondary-active':  '#e5e5e5',
            // Accent
            'accent-primary':       '#171717',
            'accent-primary-active':'#0a0a0a',
            // Text — hsl 0 0% 3.9% ≈ #0a0a0a
            'txt-primary':          '#0a0a0a',
            'txt-secondary':        '#737373',  // muted-foreground light
            'txt-primary-invert':   '#ffffff',  // white text/icons on dark active tab
            'txt-secondary-invert': '#f5f5f5',
            // Icons
            'icons-primary':        '#0a0a0a',
            'icons-secondary':      '#737373',
            'icons-primary-opacity-95':  'rgba(10,10,10,0.95)',
            // Borders — hsl 0 0% 89.8% ≈ #e5e5e5
            'border-primary':       '#e5e5e5',
            'border-secondary':     '#f5f5f5',
            // Misc
            'link-primary':         '#171717',
            'error':                '#ef4444',
            'warning':              '#f59e0b',
            'success':              '#22c55e',
          },
          typography: { fontFamily: 'system-ui, -apple-system, sans-serif' },
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

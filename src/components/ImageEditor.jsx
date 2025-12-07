import React, { useState, useEffect, useRef, useMemo } from 'react';
import Cropper from 'cropperjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Camera, 
  Upload, 
  SlidersHorizontal,
  Sparkles,
  Crop,
  RotateCcw, 
  RotateCw, 
  Sun as BrightnessIcon,
  Contrast,
  Palette,
  Droplets,
  Undo2,
  Download,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle
} from 'lucide-react';

/**
 * Advanced Image Editor Component
 * Provides comprehensive image editing capabilities with filters and transforms
 * 
 * @param {boolean} open - Whether the editor dialog is open
 * @param {function} onOpenChange - Callback when dialog open state changes
 * @param {string} imageSrc - Source URL of the image to edit (blob URL or URL)
 * @param {function} onSave - Callback when user saves edited image (receives File object)
 * @param {string} fileName - Optional filename for the saved image
 * @param {Array} allImages - Optional array of all images to apply filters to
 * @param {function} onApplyToAll - Optional callback to apply filters to all images
 * @param {string} itemId - Optional item ID to track editing history
 */
export function ImageEditor({ open, onOpenChange, imageSrc, onSave, fileName = 'edited-image.jpg', allImages = [], onApplyToAll, itemId }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [originalImgSrc, setOriginalImgSrc] = useState(null);
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    shadows: 0  // -100 to 100, 0 = normal
  });
  const [transform, setTransform] = useState({
    rotate: 0,
    flip_x: 1,
    flip_y: 1
  });
  const [activeFilter, setActiveFilter] = useState('brightness');
  const [cropper, setCropper] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('free');
  
  // Multi-image support
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editedImages, setEditedImages] = useState(new Set()); // Track which images have been edited
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [appliedToAll, setAppliedToAll] = useState(false); // Track if "Apply to All" was used
  
  const imageRef = useRef(null);
  const cropperInstanceRef = useRef(null);
  const queryClient = useQueryClient();
  
  // Store editing history per image URL to remember settings
  const imageEditHistoryRef = useRef(new Map());
  
  // Normalize images array - memoized to prevent recalculation
  const normalizedImages = useMemo(() => {
    if (allImages && allImages.length > 0) {
      return allImages.map(img => typeof img === 'string' ? img : img.imageUrl || img.url || img);
    }
    return [imageSrc];
  }, [allImages, imageSrc]);
  
  const hasMultipleImages = normalizedImages.length > 1;

  // Fetch user's saved templates
  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['imageEditorTemplates'],
    queryFn: async () => {
      try {
        const allTemplates = await base44.entities.ImageEditorTemplate.list({
          deleted_at: null  // Only get non-deleted templates
        });
        return allTemplates || [];
      } catch (error) {
        console.error('Error fetching templates:', error);
        return [];
      }
    },
    enabled: open
  });

  // Check if any changes have been made
  const checkForChanges = () => {
    const hasFilterChanges = 
      filters.brightness !== 100 || 
      filters.contrast !== 100 || 
      filters.saturate !== 100 || 
      filters.shadows !== 0;
    
    const hasTransformChanges = 
      transform.rotate !== 0 || 
      transform.flip_x !== 1 || 
      transform.flip_y !== 1;
    
    return hasFilterChanges || hasTransformChanges;
  };

  // Update hasUnsavedChanges when filters or transforms change
  useEffect(() => {
    setHasUnsavedChanges(checkForChanges());
  }, [filters, transform]);

  // Navigate to previous image
  const goToPrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      setAppliedToAll(false); // Reset when navigating
    }
  };

  // Navigate to next image
  const goToNextImage = () => {
    if (currentImageIndex < normalizedImages.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      setAppliedToAll(false); // Reset when navigating
    }
  };

  // Reset everything when dialog opens with new item
  useEffect(() => {
    if (open && imageSrc) {
      // Reset all state for fresh editing session
      setCurrentImageIndex(0);
      setEditedImages(new Set());
      setAppliedToAll(false);
      setHasUnsavedChanges(false);
      
      // Load the first image
      const imageToLoad = normalizedImages[0];
      if (imageToLoad) {
        setImgSrc(imageToLoad);
        setOriginalImgSrc(imageToLoad);
        
        // Clean up existing cropper
        if (cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
          cropperInstanceRef.current = null;
        }
        
        // Check if this image has saved editing settings
        const historyKey = itemId ? `${itemId}_0` : null;
        const savedSettings = historyKey ? imageEditHistoryRef.current.get(historyKey) : null;
        
        if (savedSettings) {
          // Load previously saved settings
          console.log('Loading saved settings for image:', savedSettings);
          setFilters(savedSettings.filters);
          setTransform(savedSettings.transform);
        } else {
          // Reset to defaults for new image
          setFilters({
            brightness: 100,
            contrast: 100,
            saturate: 100,
            shadows: 0
          });
          setTransform({
            rotate: 0,
            flip_x: 1,
            flip_y: 1
          });
        }
        
        setActiveFilter('brightness');
        setSelectedTemplate(null);
        setAspectRatio('free');
        setIsCropping(false);
      }
    }
    return () => {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
    };
  }, [open, imageSrc]);

  // Handle navigation between images in the carousel
  useEffect(() => {
    if (open && normalizedImages.length > 0) {
      const imageToLoad = normalizedImages[currentImageIndex];
      if (imageToLoad && imageToLoad !== imgSrc) {
        console.log(`Loading image ${currentImageIndex + 1}/${normalizedImages.length}:`, imageToLoad);
        setImgSrc(imageToLoad);
        setOriginalImgSrc(imageToLoad);
        
        // Clean up existing cropper
        if (cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
          cropperInstanceRef.current = null;
          setCropper(null);
          setIsCropping(false);
        }
        
        // Check if this image has saved editing settings (keyed by itemId + index)
        const historyKey = itemId ? `${itemId}_${currentImageIndex}` : null;
        const savedSettings = historyKey ? imageEditHistoryRef.current.get(historyKey) : null;
        
        if (savedSettings) {
          // Load previously saved settings for this image
          console.log(`Loading saved settings for image ${currentImageIndex}:`, savedSettings);
          setFilters(savedSettings.filters);
          setTransform(savedSettings.transform);
        } else {
          // Reset to defaults for images without saved settings
          setFilters({
            brightness: 100,
            contrast: 100,
            saturate: 100,
            shadows: 0
          });
          setTransform({
            rotate: 0,
            flip_x: 1,
            flip_y: 1
          });
        }
        
        setActiveFilter('brightness');
        setSelectedTemplate(null);
        setAspectRatio('free');
      }
    }
  }, [currentImageIndex, normalizedImages, open]);

  // Get aspect ratio value based on selection
  const getAspectRatioValue = () => {
    switch (aspectRatio) {
      case 'square': return 1; // 1:1
      case '4:3': return 4 / 3;
      case '16:9': return 16 / 9;
      case '9:16': return 9 / 16;
      case '4:5': return 4 / 5;
      case 'free': return NaN;
      default: return NaN;
    }
  };

  // Initialize Cropper.js
  const initCropper = () => {
    if (imageRef.current && !cropperInstanceRef.current) {
      try {
        // Wait for image to be fully loaded with dimensions
        const img = imageRef.current;
        if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
          img.onload = () => initCropper();
          return;
        }

        cropperInstanceRef.current = new Cropper(imageRef.current, {
          aspectRatio: getAspectRatioValue(),
          viewMode: 1, // Restrict crop box to not exceed the canvas (image) boundaries
          dragMode: 'none',
          autoCropArea: 1.0, // Start with crop box at 100% of image size
          restore: false,
          guides: true,
          center: true,
          highlight: true,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          responsive: false,
          checkOrientation: false,
          modal: true,
          background: false,
          autoCrop: true,
          movable: false,
          zoomable: false,
          zoomOnTouch: false,
          zoomOnWheel: false,
          wheelZoomRatio: 0,
          scalable: false,
          rotatable: false,
          minCropBoxWidth: 50,
          minCropBoxHeight: 50,
        });
        
        setCropper(cropperInstanceRef.current);
        setIsCropping(true);
      } catch (error) {
        console.error('Error initializing cropper:', error);
        alert('Failed to initialize crop tool: ' + error.message);
      }
    }
  };

  // Apply shadows using canvas manipulation - targets darker areas of the image
  const applyShadows = (ctx, width, height, shadowValue) => {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Shadow adjustment: -100 (darken shadows) to +100 (lighten shadows)
      const adjustment = shadowValue / 100; // -1.0 to +1.0
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate luminance (perceived brightness) - 0 to 255
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Only affect darker pixels (shadows) - more aggressive threshold
        // Pixels below 140 luminance are considered shadows
        const shadowThreshold = 140;
        
        if (luminance < shadowThreshold) {
          // Calculate shadow weight (0 to 1) - darker = higher weight
          const shadowWeight = 1 - (luminance / shadowThreshold);
          
          if (adjustment < 0) {
            // Darken shadows - more aggressive darkening
            const darkenFactor = 1 + (adjustment * shadowWeight * 1.5);
            data[i] = Math.max(0, r * darkenFactor);
            data[i + 1] = Math.max(0, g * darkenFactor);
            data[i + 2] = Math.max(0, b * darkenFactor);
          } else {
            // Lighten shadows - more aggressive lightening
            const lightenAmount = adjustment * shadowWeight * 150;
            data[i] = Math.min(255, r + lightenAmount);
            data[i + 1] = Math.min(255, g + lightenAmount);
            data[i + 2] = Math.min(255, b + lightenAmount);
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.warn('Could not apply shadow adjustment:', error);
    }
  };

  // Update image filter styles (for preview only)
  useEffect(() => {
    if (imageRef.current) {
      const filterStyle = `brightness(${filters.brightness}%) 
                          contrast(${filters.contrast}%) 
                          saturate(${filters.saturate}%)`;
      
      const transformStyle = `rotate(${transform.rotate}deg) scale(${transform.flip_x}, ${transform.flip_y})`;
      
      imageRef.current.style.filter = filterStyle;
      imageRef.current.style.transform = transformStyle;
      
      // Note: Shadows are applied during final save, not in preview
    }
  }, [filters, transform]);

  // Get slider max value based on active filter
  const getSliderMax = () => {
    switch (activeFilter) {
      case 'brightness':
      case 'contrast':
      case 'saturate':
        return 200;
      case 'shadows':
        return 100;
      default:
        return 100;
    }
  };

  // Get slider min value
  const getSliderMin = () => {
    if (activeFilter === 'shadows') {
      return -100;
    }
    return 0;
  };

  // Get slider value for active filter
  const getSliderValue = () => {
    return filters[activeFilter] || 0;
  };

  // Handle filter button click
  const handleFilterClick = (filterName) => {
    setActiveFilter(filterName);
  };

  // Handle slider change - unselect template if user manually adjusts
  const handleSliderChange = (value) => {
    if (selectedTemplate) {
      setSelectedTemplate(null);
    }
    setFilters(prev => ({
      ...prev,
      [activeFilter]: value
    }));
  };

  // Handle aspect ratio change
  const handleAspectRatioChange = (newRatio) => {
    setAspectRatio(newRatio);
    
    // If cropper is active, update its aspect ratio immediately
    if (cropperInstanceRef.current && isCropping) {
      const ratioValue = newRatio === 'free' ? NaN : 
                         newRatio === 'square' ? 1 :
                         newRatio === '4:3' ? 4 / 3 :
                         newRatio === '16:9' ? 16 / 9 :
                         newRatio === '9:16' ? 9 / 16 :
                         newRatio === '4:5' ? 4 / 5 : NaN;
      cropperInstanceRef.current.setAspectRatio(ratioValue);
    }
  };

  // Handle transform buttons
  const handleTransform = (type) => {
    if (selectedTemplate) {
      setSelectedTemplate(null);
    }
    switch (type) {
      case 'rotate_left':
        setTransform(prev => ({ ...prev, rotate: prev.rotate - 90 }));
        break;
      case 'rotate_right':
        setTransform(prev => ({ ...prev, rotate: prev.rotate + 90 }));
        break;
      case 'flip_x':
        setTransform(prev => ({ ...prev, flip_x: prev.flip_x === 1 ? -1 : 1 }));
        break;
      case 'flip_y':
        setTransform(prev => ({ ...prev, flip_y: prev.flip_y === 1 ? -1 : 1 }));
        break;
      case 'crop':
        enableCropMode();
        break;
    }
  };

  // Enable crop mode
  const enableCropMode = () => {
    if (!cropperInstanceRef.current) {
      setTimeout(() => initCropper(), 100);
    }
  };

  // Cancel crop mode
  const cancelCrop = () => {
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy();
      cropperInstanceRef.current = null;
      setCropper(null);
      setIsCropping(false);
    }
  };

  // Apply the crop
  const applyCrop = () => {
    if (!cropperInstanceRef.current) {
      alert('Crop tool not initialized. Please try again.');
      return;
    }
    
    try {
      const canvas = cropperInstanceRef.current.getCroppedCanvas({
        maxWidth: 4096,
        maxHeight: 4096,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });
      
      if (!canvas) {
        throw new Error('Failed to generate cropped canvas');
      }
      
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Failed to create image from crop. Please try again.');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          
          // Destroy cropper
          if (cropperInstanceRef.current) {
            cropperInstanceRef.current.destroy();
            cropperInstanceRef.current = null;
          }
          setCropper(null);
          setIsCropping(false);
          
          // Update image source
          setImgSrc(dataUrl);
        };
        reader.onerror = () => {
          alert('Failed to read cropped image. Please try again.');
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.95);
      
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Failed to crop image: ' + error.message);
    }
  };

  // Reset all filters and transforms
  const resetAll = () => {
    // Restore original image (undoes any crops)
    if (originalImgSrc) {
      setImgSrc(originalImgSrc);
    }
    
    setFilters({
      brightness: 100,
      contrast: 100,
      saturate: 100,
      shadows: 0
    });
    setTransform({
      rotate: 0,
      flip_x: 1,
      flip_y: 1
    });
    setActiveFilter('brightness');
    setSelectedTemplate(null);
    setAspectRatio('free');
    setAppliedToAll(false); // Reset applied to all state
    
    // Clear the editing history for this image
    if (itemId) {
      const historyKey = `${itemId}_${currentImageIndex}`;
      imageEditHistoryRef.current.delete(historyKey);
    }
    
    // Cancel crop mode if active
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy();
      cropperInstanceRef.current = null;
      setCropper(null);
      setIsCropping(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImgSrc(event.target.result);
      resetAll();
      setTimeout(() => {
        if (imageRef.current) {
          initCropper();
        }
      }, 100);
    };
    reader.readAsDataURL(file);
  };

  // Load template
  const handleLoadTemplate = (template) => {
    if (template.settings) {
      setFilters({
        brightness: template.settings.brightness ?? 100,
        contrast: template.settings.contrast ?? 100,
        saturate: template.settings.saturate ?? 100,
        shadows: template.settings.shadows ?? 0
      });
      setTransform({
        rotate: template.settings.rotate ?? 0,
        flip_x: template.settings.flip_x ?? 1,
        flip_y: template.settings.flip_y ?? 1
      });
      setSelectedTemplate(template.id);
    }
  };

  // Handle save template button click
  const handleSaveTemplateClick = () => {
    setTemplateName('');
    setShowTemplateDialog(true);
  };

  // Apply current filters and transforms to all images
  const handleApplyFiltersToAll = async () => {
    if (!onApplyToAll || !allImages || allImages.length === 0) {
      alert('No images available to apply edits to.');
      return;
    }

    const hasChanges = 
      filters.brightness !== 100 || 
      filters.contrast !== 100 || 
      filters.saturate !== 100 || 
      filters.shadows !== 0 ||
      transform.rotate !== 0 ||
      transform.flip_x !== 1 ||
      transform.flip_y !== 1;

    if (!hasChanges) {
      alert('No edits have been made to apply.');
      return;
    }

    const confirmed = confirm(`Apply current edits (filters, adjustments, and transforms) to all ${allImages.length} image(s)?`);
    if (!confirmed) return;

    try {
      const processedImages = [];
      
      for (const imageItem of allImages) {
        // Get the image URL - handle different structures
        const imageUrl = imageItem.imageUrl || imageItem.url || imageItem;
        
        // Load and process the image
        const processedFile = await applyFiltersToImage(imageUrl);
        processedImages.push({
          ...imageItem,
          file: processedFile
        });
      }
      
      // Call the callback with all processed images
      onApplyToAll(processedImages, { filters, transform });
      
      // Mark all images as edited
      const allIndices = Array.from({ length: normalizedImages.length }, (_, i) => i);
      setEditedImages(new Set(allIndices));
      setHasUnsavedChanges(false);
      setAppliedToAll(true); // Mark that apply to all was used
      
      alert(`✓ Edits applied to ${processedImages.length} image(s)!`);
    } catch (error) {
      console.error('Error applying edits to all images:', error);
      alert('Failed to apply edits to all images. Please try again.');
    }
  };

  // Apply filters and transforms to a single image and return a File object
  const applyFiltersToImage = async (imageUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate rotated dimensions
          const rotation = (transform.rotate % 360) * Math.PI / 180;
          const isRotated90 = Math.abs(transform.rotate % 180) === 90;
          
          if (isRotated90) {
            canvas.width = img.naturalHeight;
            canvas.height = img.naturalWidth;
          } else {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
          }

          // Apply transforms
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(transform.flip_x, transform.flip_y);
          ctx.rotate(rotation);

          // Apply filters
          ctx.filter = `brightness(${filters.brightness}%) 
                       contrast(${filters.contrast}%) 
                       saturate(${filters.saturate}%)`;

          ctx.drawImage(
            img,
            -img.naturalWidth / 2,
            -img.naturalHeight / 2,
            img.naturalWidth,
            img.naturalHeight
          );

          // Reset transforms for shadow application
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          
          // Apply shadows if needed
          if (filters.shadows !== 0) {
            applyShadows(ctx, canvas.width, canvas.height, filters.shadows);
          }

          // Convert to blob and create File
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' });
              resolve(file);
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/jpeg', 0.9);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  };

  // Save template to database
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    setIsSavingTemplate(true);
    try {
      const templateData = {
        name: templateName.trim(),
        settings: {
          brightness: filters.brightness,
          contrast: filters.contrast,
          saturate: filters.saturate,
          shadows: filters.shadows,
          rotate: transform.rotate,
          flip_x: transform.flip_x,
          flip_y: transform.flip_y
        }
      };

      await base44.entities.ImageEditorTemplate.create(templateData);
      
      // Refresh templates list
      await refetchTemplates();
      
      setShowTemplateDialog(false);
      setTemplateName('');
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Save edited image
  const handleSave = async () => {
    if (!imgSrc) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgSrc;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate rotated dimensions
      const rotation = (transform.rotate % 360) * Math.PI / 180;
      const isRotated90 = Math.abs(transform.rotate % 180) === 90;
      
      if (isRotated90) {
        canvas.width = img.naturalHeight;
        canvas.height = img.naturalWidth;
      } else {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }

      // Apply transforms
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(transform.flip_x, transform.flip_y);
      ctx.rotate(rotation);

      // Apply filters
      ctx.filter = `brightness(${filters.brightness}%) 
                   contrast(${filters.contrast}%) 
                   saturate(${filters.saturate}%)`;

      ctx.drawImage(
        img,
        -img.naturalWidth / 2,
        -img.naturalHeight / 2,
        img.naturalWidth,
        img.naturalHeight
      );

      // Reset transforms for shadow application
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Apply shadows
      if (filters.shadows !== 0) {
        applyShadows(ctx, canvas.width, canvas.height, filters.shadows);
      }

      // Convert to blob and create File
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          
          // Store the editing settings for this image (keyed by itemId + index)
          if (itemId) {
            const historyKey = `${itemId}_${currentImageIndex}`;
            imageEditHistoryRef.current.set(historyKey, {
              filters: { ...filters },
              transform: { ...transform },
              timestamp: Date.now()
            });
          }
          
          // Mark this image as edited
          setEditedImages(prev => new Set([...prev, currentImageIndex]));
          setHasUnsavedChanges(false);
          
          if (onSave) {
            onSave(file, currentImageIndex);
          }
          
          // Only close if single image, otherwise stay open for multi-image editing
          if (!hasMultipleImages) {
            onOpenChange(false);
          }
          
          // Show success toast for multi-image
          if (hasMultipleImages) {
            alert(`✓ Image ${currentImageIndex + 1} saved! ${editedImages.size + 1}/${normalizedImages.length} images edited.`);
          }
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Failed to save image. Please try again.');
    }
  };


  // Clean up on close
  useEffect(() => {
    if (!open) {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
    }
  }, [open]);

  if (!open) return null;

  const sliderMax = getSliderMax();
  const sliderMin = getSliderMin();
  const sliderValue = getSliderValue();
  const sliderRange = sliderMax - sliderMin;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[92vw] sm:w-[90vw] max-w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 flex flex-col">
          <DialogHeader className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-base sm:text-xl font-semibold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-xl">Advanced Photo Editor</span>
              </DialogTitle>
              
              {/* Apply to All button - Desktop only in header */}
              {hasUnsavedChanges && hasMultipleImages && onApplyToAll && (
                <Button
                  onClick={handleApplyFiltersToAll}
                  className="hidden md:flex bg-purple-600 hover:bg-purple-500 text-white text-sm h-9 px-4"
                >
                  ✨ Apply to All Images
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex flex-col md:flex-row h-auto md:flex-1 overflow-y-auto md:overflow-hidden min-h-0">
            {/* Sidebar */}
            <div className="w-full md:w-[300px] bg-slate-800/50 backdrop-blur-sm md:border-r border-slate-700/50 overflow-y-auto overflow-x-hidden p-2 sm:p-4 space-y-2 sm:space-y-6 max-h-none md:max-h-full">
              {/* Template Section */}
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Templates
                </h3>
                <Select
                  value={selectedTemplate || 'none'}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      setSelectedTemplate(null);
                      resetAll();
                    } else {
                      const template = templates.find(t => t.id === value);
                      if (template) {
                        handleLoadTemplate(template);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-slate-300 text-xs sm:text-sm h-8 sm:h-10">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Custom)</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSaveTemplateClick}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-10"
                >
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-xs sm:text-sm">Save Current Settings</span>
                </Button>
              </div>

              {/* Upload Section */}
              <div className="space-y-2 sm:space-y-3">
                <h3 className="hidden sm:flex text-xs sm:text-sm font-medium text-slate-300 items-center gap-2">
                  <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Upload
                </h3>
                <div>
                  <input
                    type="file"
                    id="imageUploader"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={() => document.getElementById('imageUploader')?.click()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-10"
                  >
                    <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm">Upload Image</span>
                  </Button>
                </div>
              </div>

              {/* Transform Section */}
              <div className="space-y-2 sm:space-y-3">
                <h3 className="hidden sm:flex text-xs sm:text-sm font-medium text-slate-300 items-center gap-2">
                  <Crop className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Transform
                </h3>
                
                {isCropping ? (
                  // When cropping, show aspect ratio selector and crop controls
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">Crop Aspect Ratio</Label>
                      <Select value={aspectRatio} onValueChange={handleAspectRatioChange}>
                        <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-slate-300 text-xs sm:text-sm h-8 sm:h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free (No Constraint)</SelectItem>
                          <SelectItem value="square">Square (1:1)</SelectItem>
                          <SelectItem value="4:3">Landscape (4:3)</SelectItem>
                          <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
                          <SelectItem value="4:5">Portrait (4:5)</SelectItem>
                          <SelectItem value="9:16">Vertical (9:16)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={cancelCrop}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm h-9"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={applyCrop}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs sm:text-sm h-9"
                      >
                        ✓ Apply
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleTransform('crop')}
                      className="w-full p-2 sm:p-3 rounded-lg border bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-600/50 transition-all duration-300 flex flex-col items-center gap-1 sm:gap-2"
                    >
                      <Crop className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-[10px] sm:text-xs">Crop</span>
                    </button>
                  </div>
                )}

                {/* Adjustments Section - Hidden when cropping */}
                {!isCropping && (
                  <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                    <h3 className="hidden sm:flex text-xs sm:text-sm font-medium text-slate-300 items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Adjustments
                    </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span className="capitalize">{activeFilter === 'shadows' ? 'Shadows' : activeFilter}</span>
                      <span>
                        {activeFilter === 'shadows' 
                          ? `${sliderValue > 0 ? '+' : ''}${sliderValue}` 
                          : `${sliderValue}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      value={sliderValue}
                      onChange={(e) => handleSliderChange(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: sliderRange > 0
                          ? `linear-gradient(to right, #475569 0%, #6c5ce7 ${((sliderValue - sliderMin) / sliderRange) * 100}%, #6c5ce7 ${((sliderValue - sliderMin) / sliderRange) * 100}%, #475569 100%)`
                          : '#475569'
                      }}
                    />
                  </div>
                </div>
                )}

                {/* Filters Section - Hidden when cropping */}
                {!isCropping && (
                  <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                    <h3 className="hidden sm:flex text-xs sm:text-sm font-medium text-slate-300 items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Filters
                    </h3>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {[
                      { id: 'brightness', icon: BrightnessIcon, label: 'Brightness' },
                      { id: 'contrast', icon: Contrast, label: 'Contrast' },
                      { id: 'saturate', icon: Palette, label: 'Saturation' },
                      { id: 'shadows', icon: Droplets, label: 'Shadows' },
                    ].map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => handleFilterClick(id)}
                        className={`p-2 sm:p-3 rounded-lg border transition-all duration-300 flex flex-col items-center gap-1 sm:gap-2 ${
                          activeFilter === id
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-600/50'
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-[10px] sm:text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

            {/* Main Content */}
            <div className="w-full md:flex-1 flex flex-col min-w-0 px-2 sm:p-4 h-[350px] md:h-full overflow-hidden mt-auto md:mt-0" style={{ background: isCropping ? '#f8fafc' : 'transparent' }}>
              <div 
                className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center" 
                style={{ 
                  background: isCropping ? '#ffffff' : '#0f172a',
                  border: isCropping ? '2px solid #e2e8f0' : '1px solid #334155'
                }}
              >
                {imgSrc && (
                  <div className="relative inline-block max-w-full max-h-full w-full h-full flex items-center justify-center">
                    {/* Image edited checkmark - top right */}
                    {editedImages.has(currentImageIndex) && (
                      <div className="absolute top-4 right-4 z-20">
                        <CheckCircle className="w-8 h-8 text-green-500 fill-white drop-shadow-lg" />
                      </div>
                    )}

                    {/* Multi-image navigation */}
                    {hasMultipleImages && (
                      <>
                        {/* Previous button */}
                        {currentImageIndex > 0 && (
                          <button
                            onClick={goToPrevImage}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center z-20 transition-all hover:scale-110"
                            title="Previous image"
                          >
                            <ChevronLeft className="w-6 h-6 text-gray-800" />
                          </button>
                        )}

                        {/* Next button */}
                        {currentImageIndex < normalizedImages.length - 1 && (
                          <button
                            onClick={goToNextImage}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg flex items-center justify-center z-20 transition-all hover:scale-110"
                            title="Next image"
                          >
                            <ChevronRight className="w-6 h-6 text-gray-800" />
                          </button>
                        )}

                        {/* Image counter */}
                        <div className="absolute top-4 left-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full z-10">
                          {currentImageIndex + 1} / {normalizedImages.length}
                        </div>
                      </>
                    )}

                    <img
                      ref={imageRef}
                      src={imgSrc}
                      alt="Editor Preview"
                      className="block object-contain max-w-[90%] max-h-[90%]"
                      style={{
                        width: 'auto',
                        height: 'auto',
                        maxWidth: window.innerWidth >= 768 ? '60%' : '90%',
                        maxHeight: window.innerWidth >= 768 ? '60vh' : '90%',
                        filter: `brightness(${filters.brightness}%) 
                                  contrast(${filters.contrast}%) 
                                  saturate(${filters.saturate}%)`,
                        transform: `rotate(${transform.rotate}deg) scale(${transform.flip_x}, ${transform.flip_y})`
                      }}
                    />
                    
                    {/* Rotate buttons overlay - always visible */}
                    <div style={{
                      position: 'absolute',
                      bottom: '16px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      gap: '12px',
                      zIndex: 1000
                    }}>
                      <button
                        onClick={() => handleTransform('rotate_left')}
                        className="w-10 h-10 rounded-full bg-white border-2 border-blue-500 shadow-lg hover:bg-blue-50 flex items-center justify-center transition-all hover:scale-110"
                        title="Rotate Left"
                      >
                        <RotateCcw className="w-5 h-5 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleTransform('rotate_right')}
                        className="w-10 h-10 rounded-full bg-white border-2 border-blue-500 shadow-lg hover:bg-blue-50 flex items-center justify-center transition-all hover:scale-110"
                        title="Rotate Right"
                      >
                        <RotateCw className="w-5 h-5 text-blue-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {isCropping && (
                <div className="mt-3 text-center text-slate-700 text-sm bg-white px-4 py-2 rounded-lg border border-slate-200">
                  <p className="font-medium">✨ Drag the crop box or resize using the corners and edges</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 sm:px-5 py-3 border-t border-slate-700/50 bg-slate-800/50 backdrop-blur-sm flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
            <Button
              onClick={resetAll}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-base">Reset All</span>
            </Button>
            
            {/* Apply to All button - Mobile only in footer */}
            {!isCropping && hasUnsavedChanges && hasMultipleImages && onApplyToAll && (
              <Button
                onClick={handleApplyFiltersToAll}
                className="md:hidden flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm"
              >
                ✨ Apply to All
              </Button>
            )}
            
            {!isCropping && (
              <Button
                onClick={(appliedToAll || editedImages.has(currentImageIndex)) ? () => onOpenChange(false) : handleSave}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-2 text-sm sm:text-base"
                disabled={!imgSrc}
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-base">
                  {appliedToAll || editedImages.has(currentImageIndex)
                    ? 'Done' 
                    : hasMultipleImages 
                      ? `Save Image ${currentImageIndex + 1}` 
                      : 'Save Image'}
                </span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Name Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Save Template</DialogTitle>
            <DialogDescription className="text-slate-400">
              Give your image adjustment template a name so you can use it again later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name" className="text-slate-300">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Bright & Vibrant"
                className="bg-slate-700 border-slate-600 text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && templateName.trim()) {
                    handleSaveTemplate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTemplateDialog(false);
                setTemplateName('');
              }}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || isSavingTemplate}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {isSavingTemplate ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

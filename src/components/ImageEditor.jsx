import React, { useState, useEffect, useRef, useMemo } from 'react';
import Cropper from 'cropperjs';
import imageCompression from 'browser-image-compression';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { imageEditorTemplatesApi } from '@/api/imageEditorTemplatesApi';
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
  Undo2,
  Download,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Layers
} from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Advanced Image Editor Component
 * Provides comprehensive image editing capabilities with filters and transforms
 *
 * NOTE:
 * - This component is used on pages where it is often rendered "closed" (open=false).
 * - To avoid crashes from malformed image arrays (e.g. null entries) and to reduce work,
 *   we only mount the heavy implementation when open=true.
 */
function ImageEditorInner({ open, onOpenChange, imageSrc, onSave, fileName = 'edited-image.jpg', allImages = [], onApplyToAll, itemId, onAddImage }) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  // When itemId is not available (e.g. editing before the item is created),
  // use a stable per-session key so per-image settings don't get lost when URLs change after uploads.
  const sessionKeyRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [originalImgSrc, setOriginalImgSrc] = useState(null);
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    // Canva-like semantics: 100 = original image (no change)
    shadow: 100
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
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('free');
  const [cropData, setCropData] = useState(null); // Store crop coordinates for applying to all images
  
  // Multi-image support
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editedImages, setEditedImages] = useState(new Set()); // Track which images have been edited
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [appliedToAll, setAppliedToAll] = useState(false); // Track if "Apply to All" was used
  
  // Track loaded baseline settings for comparison
  const [loadedFilters, setLoadedFilters] = useState(null);
  const [loadedTransform, setLoadedTransform] = useState(null);
  
  const imageRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const cropperInstanceRef = useRef(null);
  const queryClient = useQueryClient();
  const previewRenderTimerRef = useRef(null);
  const previewRenderAbortRef = useRef({ cancelled: false, token: 0 });
  
  // Store editing history per image URL to remember settings - persisted to localStorage
  const imageEditHistoryRef = useRef((() => {
    try {
      const stored = localStorage.getItem('imageEditHistory');
      return stored ? new Map(JSON.parse(stored)) : new Map();
    } catch {
      return new Map();
    }
  })());
  
  // Store temporary unsaved state per image index (including crops) - session only
  const tempImageStateRef = useRef(new Map());
  
  // Normalize images array + stable per-image keys.
  // - If the parent provides image objects with an `id`, use that id as the key (survives reordering).
  // - Otherwise, fall back to index-based keys.
  const { normalizedImages, normalizedImageKeys } = useMemo(() => {
    // IMPORTANT: some saved data can include null entries; filter them out defensively.
    const rawImgs = (allImages && allImages.length > 0) ? allImages : [imageSrc];
    const imgs = (rawImgs || []).filter(Boolean);
    const urls = [];
    const keys = [];

    imgs.forEach((img, idx) => {
      const isObj = img && typeof img === 'object';
      const url = typeof img === 'string' ? img : (img.imageUrl || img.url || img.preview || img);
      const key = isObj && img.id ? String(img.id) : String(idx);
      urls.push(url);
      keys.push(key);
    });

    return { normalizedImages: urls, normalizedImageKeys: keys };
  }, [allImages, imageSrc]);
  
  const hasMultipleImages = normalizedImages.length > 1;

  // Fetch user's saved templates
  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ['imageEditorTemplates'],
    queryFn: async () => {
      try {
        const allTemplates = await imageEditorTemplatesApi.list(null, { deleted_at: null });
        return allTemplates || [];
      } catch (error) {
        console.error('Error fetching templates:', error);
        return [];
      }
    },
    enabled: open
  });

  // Check if any changes have been made from loaded state
  const checkForChanges = () => {
    // Check if image has been cropped (imgSrc differs from originalImgSrc)
    const hasCropChanges = imgSrc !== originalImgSrc;
    
    if (!loadedFilters || !loadedTransform) {
      // If no loaded state yet, compare to defaults
      const hasFilterChanges = 
        filters.brightness !== 100 || 
        filters.contrast !== 100 || 
        filters.saturate !== 100 ||
        filters.shadow !== 100;
      
      const hasTransformChanges = 
        transform.rotate !== 0 || 
        transform.flip_x !== 1 || 
        transform.flip_y !== 1;
      
      return hasCropChanges || hasFilterChanges || hasTransformChanges;
    }
    
    // Compare to loaded state
    const hasFilterChanges = 
      filters.brightness !== loadedFilters.brightness || 
      filters.contrast !== loadedFilters.contrast || 
      filters.saturate !== loadedFilters.saturate ||
      filters.shadow !== (loadedFilters.shadow ?? 100);
    
    const hasTransformChanges = 
      transform.rotate !== loadedTransform.rotate || 
      transform.flip_x !== loadedTransform.flip_x || 
      transform.flip_y !== loadedTransform.flip_y;
    
    return hasCropChanges || hasFilterChanges || hasTransformChanges;
  };
  
  // Check if there are changes from ORIGINAL (for Reset All button)
  const hasChangesFromOriginal = () => {
    const hasCropChanges = imgSrc !== originalImgSrc;
    const hasFilterChanges = 
      filters.brightness !== 100 || 
      filters.contrast !== 100 || 
      filters.saturate !== 100 ||
      filters.shadow !== 100;
    
    const hasTransformChanges = 
      transform.rotate !== 0 || 
      transform.flip_x !== 1 || 
      transform.flip_y !== 1;
    
    return hasCropChanges || hasFilterChanges || hasTransformChanges;
  };

  // Update hasUnsavedChanges when filters, transforms, or image source change
  useEffect(() => {
    const hasChanges = checkForChanges();
    console.log('Checking for changes:', { 
      currentFilters: filters, 
      loadedFilters,
      imgSrc,
      originalImgSrc,
      hasChanges,
      hasUnsavedChanges 
    });
    setHasUnsavedChanges(hasChanges);
  }, [filters, transform, loadedFilters, loadedTransform, imgSrc, originalImgSrc]);

  // Save current image state before navigating
  const saveCurrentImageState = () => {
    tempImageStateRef.current.set(currentImageIndex, {
      imgSrc,
      originalImgSrc,
      filters: { ...filters },
      transform: { ...transform },
      selectedTemplate,
      aspectRatio,
      isCropping,
      cropData: cropData ? { ...cropData } : null
    });
    console.log(`Saved state for image ${currentImageIndex}:`, tempImageStateRef.current.get(currentImageIndex));
  };

  // Navigate to previous image
  const goToPrevImage = () => {
    if (currentImageIndex > 0) {
      saveCurrentImageState(); // Save current state before navigating
      setCurrentImageIndex(currentImageIndex - 1);
      setAppliedToAll(false); // Reset when navigating
    }
  };

  // Navigate to next image
  const goToNextImage = () => {
    if (currentImageIndex < normalizedImages.length - 1) {
      saveCurrentImageState(); // Save current state before navigating
      setCurrentImageIndex(currentImageIndex + 1);
      setAppliedToAll(false); // Reset when navigating
    }
  };

  // Preload adjacent images for smoother navigation (reduces perceived lag).
  useEffect(() => {
    if (!open) return;
    if (!normalizedImages || normalizedImages.length === 0) return;
    const urls = [];
    const prev = normalizedImages[currentImageIndex - 1];
    const next = normalizedImages[currentImageIndex + 1];
    if (typeof prev === 'string') urls.push(prev);
    if (typeof next === 'string') urls.push(next);
    urls.forEach((u) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = u;
      } catch (_) {}
    });
  }, [open, normalizedImages, currentImageIndex]);

  // Reset everything when dialog opens with new item
  useEffect(() => {
    if (open && imageSrc) {
      // New editing session (or different image set) → new session key.
      // Keep stable for the entire time the editor is open.
      sessionKeyRef.current = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Reset all state for fresh editing session
      setCurrentImageIndex(0);
      setEditedImages(new Set());
      setAppliedToAll(false);
      setHasUnsavedChanges(false);
      tempImageStateRef.current.clear(); // Clear temporary unsaved states
      
      // Load the first image
      const imageToLoad = normalizedImages[0];
      if (imageToLoad) {
        // Clean up existing cropper
        if (cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
          cropperInstanceRef.current = null;
        }
        
        // Check if this image has saved editing settings
        const historyKey = getHistoryKeyForIndex(0);
        const savedSettings = historyKey ? imageEditHistoryRef.current.get(historyKey) : null;
        const urlToLoad = savedSettings?.originalImageUrl || imageToLoad;

        setImgSrc(urlToLoad);
        setOriginalImgSrc(urlToLoad);
        
        if (savedSettings) {
          // Load previously saved settings
          console.log('Loading saved settings for image:', savedSettings);
          setFilters(savedSettings.filters);
          setTransform(savedSettings.transform);
          // Treat loaded settings as baseline so Image 1 shows "Done" once saved/applied
          setLoadedFilters(savedSettings.filters);
          setLoadedTransform(savedSettings.transform);
        } else {
          // Reset to defaults for new image
          const defaultFilters = {
            brightness: 100,
            contrast: 100,
            saturate: 100,
            shadow: 100
          };
          const defaultTransform = {
            rotate: 0,
            flip_x: 1,
            flip_y: 1
          };
          setFilters(defaultFilters);
          setTransform(defaultTransform);
          setLoadedFilters(defaultFilters);
          setLoadedTransform(defaultTransform);
        }
        
        setActiveFilter('brightness');
        setSelectedTemplate(null);
        setAspectRatio('free');
        setIsCropping(false);
        setCropData(null); // Reset crop data for new item
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
      
      // First check if there's a temporary unsaved state for this image
      const tempState = tempImageStateRef.current.get(currentImageIndex);
      
      if (tempState) {
        // Restore temporary unsaved state (user navigated away and came back)
        console.log(`Restoring unsaved state for image ${currentImageIndex}:`, tempState);
        setImgSrc(tempState.imgSrc);
        setOriginalImgSrc(tempState.originalImgSrc);
        setFilters(tempState.filters);
        setTransform(tempState.transform);
        setSelectedTemplate(tempState.selectedTemplate);
        setAspectRatio(tempState.aspectRatio);
        setIsCropping(tempState.isCropping);
        setCropData(tempState.cropData);
        
        // Clean up existing cropper if not cropping
        if (!tempState.isCropping && cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
          cropperInstanceRef.current = null;
          setCropper(null);
        }
        
        return; // Skip the rest of the logic
      }
      
      // Check if there are saved settings with an original URL
      const historyKey = getHistoryKeyForIndex(currentImageIndex);
      const savedSettings = historyKey ? imageEditHistoryRef.current.get(historyKey) : null;
      const urlToLoad = savedSettings?.originalImageUrl || imageToLoad;
      
      if (urlToLoad && urlToLoad !== imgSrc) {
        console.log(`Loading image ${currentImageIndex + 1}/${normalizedImages.length}:`, urlToLoad, savedSettings ? '(from original)' : '(current)');
        console.log('Loading image - historyKey:', historyKey, 'imageURL:', imageToLoad);
        console.log('Available history keys:', Array.from(imageEditHistoryRef.current.keys()));
        
        setImgSrc(urlToLoad);
        setOriginalImgSrc(urlToLoad);
        
        // Clean up existing cropper
        if (cropperInstanceRef.current) {
          cropperInstanceRef.current.destroy();
          cropperInstanceRef.current = null;
          setCropper(null);
          setIsCropping(false);
        }
        
        // Keep history "imageUrl" in sync with whatever URL the parent currently provides.
        // The editor itself re-uploads images (new filenames), so URL changes are expected and
        // should NOT be treated as user "replacing" the image.
        if (savedSettings && imageToLoad && savedSettings.imageUrl !== imageToLoad) {
          try {
            const nextSettings = {
              ...savedSettings,
              imageUrl: imageToLoad,
              timestamp: Date.now(),
            };
            imageEditHistoryRef.current.set(historyKey, nextSettings);
            localStorage.setItem('imageEditHistory', JSON.stringify(Array.from(imageEditHistoryRef.current.entries())));
          } catch (e) {
            console.error('Failed to sync edit history imageUrl:', e);
          }
        }

        if (savedSettings) {
          // Load previously saved settings for this image
          console.log(`Loading saved settings for image ${currentImageIndex}:`, savedSettings);
          console.log('Current selectedTemplate before restore:', selectedTemplate);
          console.log('Template ID from settings:', savedSettings.templateId);
          console.log('Available templates:', templates?.map(t => ({ id: t.id, name: t.name })));
          
          setFilters(savedSettings.filters);
          setTransform(savedSettings.transform);
          setLoadedFilters(savedSettings.filters);
          setLoadedTransform(savedSettings.transform);
          
          // Restore template selection (use new field name or fallback to old)
          const templateToRestore = savedSettings.templateId || savedSettings.templateName || null;
          console.log('Setting template to:', templateToRestore);
          setSelectedTemplate(templateToRestore);
          
          // Verify it was set
          setTimeout(() => {
            console.log('Template after setState:', templateToRestore);
          }, 100);
        } else {
          // Reset to defaults for images without saved settings
          console.log('No saved settings found, using defaults');
          const defaultFilters = {
            brightness: 100,
            contrast: 100,
            saturate: 100,
            shadow: 100
          };
          const defaultTransform = {
            rotate: 0,
            flip_x: 1,
            flip_y: 1
          };
          setFilters(defaultFilters);
          setTransform(defaultTransform);
          setLoadedFilters(defaultFilters);
          setLoadedTransform(defaultTransform);
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


  // Update image filter styles (for preview only)
  useEffect(() => {
    // When NOT cropping, we render a canvas preview so adjustments match what will be saved.
    // Cropper requires a real <img>, so we only use the <img> element while cropping.
    if (!isCropping) return;

    if (imageRef.current) {
      const filterStyle = `brightness(${filters.brightness}%) 
                          contrast(${filters.contrast}%) 
                          saturate(${filters.saturate}%)`;
      
      const transformStyle = `rotate(${transform.rotate}deg) scale(${transform.flip_x}, ${transform.flip_y})`;
      
      imageRef.current.style.filter = filterStyle;
      imageRef.current.style.transform = transformStyle;
    }
  }, [filters, transform]);

  // --- Canva-like "Shadows" adjustment ---
  // Previously `shadow` was implemented as an *outer* drop-shadow. Users expect a tonal shadow lift
  // (affecting darker pixels inside the image). We apply that in the canvas pipeline for preview + save.
  const applyShadowsAdjustment = (ctx, canvas, shadowValue) => {
    // shadowValue: 0..200 where 100 = neutral (original image)
    const v = Number(shadowValue);
    if (!Number.isFinite(v)) return;
    const delta = v - 100; // -100..+100
    if (delta === 0) return;

    const strength = Math.min(Math.max(Math.abs(delta) / 100, 0), 1);
    const direction = delta > 0 ? 1 : -1;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        if (a === 0) continue;

        // Perceptual-ish luminance.
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 0..255

        if (lum >= 140) continue; // only lift shadows, not mid/highlights

        const t = (140 - lum) / 140; // 0..1, stronger in darker areas
        const lift = strength * t * 60 * direction; // max ~60 levels in deep shadows

        d[i] = Math.min(255, Math.max(0, r + lift));
        d[i + 1] = Math.min(255, Math.max(0, g + lift));
        d[i + 2] = Math.min(255, Math.max(0, b + lift));
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      // Some browsers can throw if canvas is tainted; in that case we simply skip shadows adjustment.
      console.warn('Shadows adjustment skipped:', e?.message || e);
    }
  };

  // Render preview to canvas (throttled) so what you see matches what you save.
  useEffect(() => {
    if (!open) return;
    if (!imgSrc) return;
    if (isCropping) return;

    // Cancel any pending timer
    if (previewRenderTimerRef.current) {
      clearTimeout(previewRenderTimerRef.current);
      previewRenderTimerRef.current = null;
    }

    const token = (previewRenderAbortRef.current.token || 0) + 1;
    previewRenderAbortRef.current.token = token;
    previewRenderAbortRef.current.cancelled = false;

    // Throttle slightly to keep sliders feeling smooth.
    previewRenderTimerRef.current = setTimeout(() => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (previewRenderAbortRef.current.token !== token) return;

        // Downscale preview to keep it fast.
        const maxDim = 1400;
        const srcW = img.naturalWidth || 1;
        const srcH = img.naturalHeight || 1;
        const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
        const w = Math.max(1, Math.round(srcW * scale));
        const h = Math.max(1, Math.round(srcH * scale));

        const rotationDeg = transform.rotate % 360;
        const isRotated90 = Math.abs(rotationDeg % 180) === 90;

        canvas.width = isRotated90 ? h : w;
        canvas.height = isRotated90 ? w : h;

        // Clear with white like Canva export defaults.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Filters (brightness/contrast/saturate).
        ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`;

        // Transform around center.
        const rotation = (rotationDeg * Math.PI) / 180;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(transform.flip_x, transform.flip_y);
        ctx.rotate(rotation);

        // Draw image
        ctx.drawImage(img, -w / 2, -h / 2, w, h);

        // Reset transform and apply tonal shadows lift (post-process).
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = 'none';
        applyShadowsAdjustment(ctx, canvas, filters.shadow);
      };

      img.onerror = () => {
        // If the image can't be loaded, just leave the previous preview.
      };

      img.src = imgSrc;
    }, 40);

    return () => {
      if (previewRenderTimerRef.current) {
        clearTimeout(previewRenderTimerRef.current);
        previewRenderTimerRef.current = null;
      }
    };
  }, [
    open,
    imgSrc,
    isCropping,
    filters.brightness,
    filters.contrast,
    filters.saturate,
    filters.shadow,
    transform.rotate,
    transform.flip_x,
    transform.flip_y,
  ]);

  // Get slider max value based on active filter
  const getSliderMax = () => {
    switch (activeFilter) {
      case 'brightness':
      case 'contrast':
      case 'saturate':
        return 200;
      case 'shadow':
        return 200;
      default:
        return 100;
    }
  };

  // Get slider min value
  const getSliderMin = () => {
    return 0;
  };

  // Get slider value for active filter
  const getSliderValue = () => {
    if (activeFilter === 'shadow') return filters.shadow ?? 100;
    return filters[activeFilter] ?? 0;
  };

  // Handle filter button click
  const handleFilterClick = (filterName) => {
    setActiveFilter(filterName);
  };

  // Handle slider change - clear template when user manually adjusts
  const handleSliderChange = (value) => {
    if (selectedTemplate) {
      setSelectedTemplate(null); // Change to "None (Custom)" when adjusting
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

  // Handle transform buttons - clear template when user manually transforms
  const handleTransform = (type) => {
    if (selectedTemplate) {
      setSelectedTemplate(null); // Change to "None (Custom)" when transforming
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
    // Switching to crop mode must render the <img> first (Cropper can't attach to <canvas>).
    if (!isCropping) setIsCropping(true);
    // Initialize once the <img> is mounted and has dimensions.
    setTimeout(() => initCropper(), 0);
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
      // Get crop data (proportional coordinates) for applying to all images
      const cropData = cropperInstanceRef.current.getData(); // Gets crop coordinates relative to natural image size
      const imageData = cropperInstanceRef.current.getImageData();
      
      // Calculate proportional crop coordinates (0-1 range) relative to natural image dimensions
      const proportionalCrop = {
        left: cropData.x / imageData.naturalWidth,
        top: cropData.y / imageData.naturalHeight,
        width: cropData.width / imageData.naturalWidth,
        height: cropData.height / imageData.naturalHeight
      };
      
      // Store crop data for potential "Apply to All" use
      setCropData(proportionalCrop);
      console.log('Stored crop data (proportional):', proportionalCrop);
      console.log('Natural image size:', imageData.naturalWidth, 'x', imageData.naturalHeight);
      
      const canvas = cropperInstanceRef.current.getCroppedCanvas({
        maxWidth: 2560,
        maxHeight: 2560,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'medium',
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
  const defaultFilters = useMemo(
    () => ({
      brightness: 100,
      contrast: 100,
      saturate: 100,
      shadow: 100,
    }),
    []
  );

  const defaultTransform = useMemo(
    () => ({
      rotate: 0,
      flip_x: 1,
      flip_y: 1,
    }),
    []
  );

  const getHistoryKeyForIndex = (idx) => {
    const k = normalizedImageKeys?.[idx] ?? String(idx);
    return itemId !== undefined ? `${itemId}_${k}` : `session_${sessionKeyRef.current}_${k}`;
  };

  const resetCurrentImage = () => {
    // Restore original baseline image for this index (undoes any crops/dataUrl changes)
    const baselineUrl =
      imageEditHistoryRef.current.get(getHistoryKeyForIndex(currentImageIndex))?.originalImageUrl ||
      originalImgSrc ||
      normalizedImages[currentImageIndex];

    if (baselineUrl) {
      setImgSrc(baselineUrl);
      setOriginalImgSrc(baselineUrl);
    }

    // Clear crop data + reset adjustments
    setCropData(null);
    setFilters(defaultFilters);
    setTransform(defaultTransform);
    setLoadedFilters(defaultFilters);
    setLoadedTransform(defaultTransform);
    setActiveFilter('brightness');
    setSelectedTemplate(null);
    setAspectRatio('free');

    // Mark this image as no longer "completed" in-session
    setEditedImages((prev) => {
      const next = new Set(prev);
      next.delete(currentImageIndex);
      return next;
    });

    // Persist reset baseline for this image so returning to edit doesn't snap back to previous edits
    try {
      const historyKey = getHistoryKeyForIndex(currentImageIndex);
      const existing = imageEditHistoryRef.current.get(historyKey);
      if (existing?.originalImageUrl) {
        imageEditHistoryRef.current.set(historyKey, {
          ...existing,
          filters: { ...defaultFilters },
          transform: { ...defaultTransform },
          timestamp: Date.now(),
        });
        localStorage.setItem(
          'imageEditHistory',
          JSON.stringify(Array.from(imageEditHistoryRef.current.entries()))
        );
      }
    } catch (e) {
      console.error('Failed to persist reset state:', e);
    }

    // Cancel crop mode if active
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy();
      cropperInstanceRef.current = null;
      setCropper(null);
      setIsCropping(false);
    }
  };

  const resetAllImages = () => {
    // Only intended after Apply-to-All on Image 1.
    // Reset every image back to its original baseline (before any edits).
    const count = normalizedImages.length;

    // Prepare default state for each image so navigation shows them reset immediately
    for (let i = 0; i < count; i++) {
      const historyKey = getHistoryKeyForIndex(i);
      const existing = imageEditHistoryRef.current.get(historyKey);
      const baselineUrl = existing?.originalImageUrl || normalizedImages[i];

      tempImageStateRef.current.set(i, {
        imgSrc: baselineUrl,
        originalImgSrc: baselineUrl,
        filters: { ...defaultFilters },
        transform: { ...defaultTransform },
        selectedTemplate: null,
        aspectRatio: 'free',
        isCropping: false,
        cropData: null,
      });

      // Persist reset for each image while preserving the original baseline URL
      if (existing?.originalImageUrl) {
        imageEditHistoryRef.current.set(historyKey, {
          ...existing,
          filters: { ...defaultFilters },
          transform: { ...defaultTransform },
          timestamp: Date.now(),
        });
      }
    }

    try {
      localStorage.setItem('imageEditHistory', JSON.stringify(Array.from(imageEditHistoryRef.current.entries())));
    } catch (e) {
      console.error('Failed to persist reset-all state:', e);
    }

    // Apply to current UI immediately
    const currentBaseline =
      tempImageStateRef.current.get(currentImageIndex)?.imgSrc ||
      originalImgSrc ||
      normalizedImages[currentImageIndex];
    if (currentBaseline) {
      setImgSrc(currentBaseline);
      setOriginalImgSrc(currentBaseline);
    }
    setCropData(null);
    setFilters(defaultFilters);
    setTransform(defaultTransform);
    setLoadedFilters(defaultFilters);
    setLoadedTransform(defaultTransform);
    setSelectedTemplate(null);
    setAspectRatio('free');
    setActiveFilter('brightness');

    setEditedImages(new Set());
    setAppliedToAll(false);

    // Cancel crop mode if active
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy();
      cropperInstanceRef.current = null;
      setCropper(null);
      setIsCropping(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onAddImage && itemId) {
      // Upload and add new image to the item
      try {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.25,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        });
        const fileToUpload = compressedFile || file;
        const uploadPayload = fileToUpload instanceof File ? fileToUpload : new File([fileToUpload], file.name, { type: file.type });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
        
        // Call the callback to add the new image
        onAddImage(file_url);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image. Please try again.');
      }
    } else {
      // Replace current image (original behavior)
      const reader = new FileReader();
      reader.onload = (event) => {
        setImgSrc(event.target.result);
        resetCurrentImage();
        setTimeout(() => {
          if (imageRef.current) {
            initCropper();
          }
        }, 100);
      };
      reader.readAsDataURL(file);
    }
  };

  // Load template
  const handleLoadTemplate = (template) => {
    if (template.settings) {
      setFilters({
        brightness: template.settings.brightness ?? 100,
        contrast: template.settings.contrast ?? 100,
        saturate: template.settings.saturate ?? 100,
        shadow: template.settings.shadow ?? 100
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
      filters.shadow !== 100 ||
      transform.rotate !== 0 ||
      transform.flip_x !== 1 ||
      transform.flip_y !== 1 ||
      cropData !== null; // Also check for crop changes

    if (!hasChanges) {
      return;
    }

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

      // Persist the applied settings per image so navigating between images keeps the same values,
      // and so reopening the editor restores the last-used adjustments while preserving an original baseline.
      if (itemId !== undefined || sessionKeyRef.current) {
        try {
          for (let i = 0; i < normalizedImages.length; i++) {
            const historyKey = getHistoryKeyForIndex(i);
            const existingSettings = imageEditHistoryRef.current.get(historyKey);
            const originalImageUrl = existingSettings?.originalImageUrl || normalizedImages[i];
            imageEditHistoryRef.current.set(historyKey, {
              filters: { ...filters },
              transform: { ...transform },
              timestamp: Date.now(),
              // Track the currently stored image URL (can change after uploads; we sync it on load)
              imageUrl: normalizedImages[i],
              // Never overwrite the original baseline once set
              originalImageUrl,
              templateId: selectedTemplate || existingSettings?.templateId || null,
            });
          }
          localStorage.setItem('imageEditHistory', JSON.stringify(Array.from(imageEditHistoryRef.current.entries())));
        } catch (e) {
          console.error('Failed to persist apply-to-all settings:', e);
        }
      }
      
      // Mark all images as edited
      const allIndices = Array.from({ length: normalizedImages.length }, (_, i) => i);
      setEditedImages(new Set(allIndices));
      setHasUnsavedChanges(false);
      setAppliedToAll(true); // Mark that apply to all was used
      // Treat current settings as baseline so the primary button reads "Done"
      setLoadedFilters({ ...filters });
      setLoadedTransform({ ...transform });
      
      // Clear all temporary unsaved states since all images have been processed
      tempImageStateRef.current.clear();
      
      toast({
        title: "Edits Applied",
        description: `Successfully applied edits to ${processedImages.length} image(s)!`,
      });
    } catch (error) {
      console.error('Error applying edits to all images:', error);
      toast({
        title: "Error",
        description: "Failed to apply edits to all images. Please try again.",
        variant: "destructive",
      });
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
          
          let sourceWidth = img.naturalWidth;
          let sourceHeight = img.naturalHeight;
          let sourceX = 0;
          let sourceY = 0;
          
          // Step 1: Calculate crop if cropData exists
          if (cropData) {
            console.log('Applying crop to image:', cropData);
            sourceX = sourceWidth * cropData.left;
            sourceY = sourceHeight * cropData.top;
            sourceWidth = sourceWidth * cropData.width;
            sourceHeight = sourceHeight * cropData.height;
            console.log('Crop dimensions:', { sourceX, sourceY, sourceWidth, sourceHeight });
          }
          
          // Step 2: Calculate rotated dimensions
          const rotation = (transform.rotate % 360) * Math.PI / 180;
          const isRotated90 = Math.abs(transform.rotate % 180) === 90;
          
          if (isRotated90) {
            canvas.width = sourceHeight;
            canvas.height = sourceWidth;
          } else {
            canvas.width = sourceWidth;
            canvas.height = sourceHeight;
          }
          
          console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);

          // Step 3: Apply transforms
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(transform.flip_x, transform.flip_y);
          ctx.rotate(rotation);

          // Step 4: Apply filters
          ctx.filter = `brightness(${filters.brightness}%) 
                       contrast(${filters.contrast}%) 
                       saturate(${filters.saturate}%)`;

          // Step 5: Draw the image (cropped if needed)
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,  // Source (crop area)
            -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight  // Destination
          );

          // Reset transforms for final output
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          // Tonal shadows adjustment (post-process on the rendered pixels)
          applyShadowsAdjustment(ctx, canvas, filters.shadow);

          // Step 7: Convert to blob and create File
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' });
              console.log('Successfully created file with crop');
              resolve(file);
            } else {
              reject(new Error('Failed to create blob'));
            }
          }, 'image/jpeg', 0.9);
        } catch (error) {
          console.error('Error in applyFiltersToImage:', error);
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  };

  // Show delete confirmation dialog
  const handleDeleteTemplate = (templateId, templateName, e) => {
    e.stopPropagation(); // Prevent SelectItem from being selected
    setTemplateToDelete({ id: templateId, name: templateName });
    setShowDeleteConfirmDialog(true);
  };

  // Actually delete template from database after confirmation
  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    
    try {
      // Soft delete by setting deleted_at
      await imageEditorTemplatesApi.update(templateToDelete.id, {
        deleted_at: new Date().toISOString()
      });
      
      // If this template was selected, reset to "None (Custom)"
      if (selectedTemplate === templateToDelete.id) {
        setSelectedTemplate(null);
        resetCurrentImage();
      }
      
      // Refresh templates list
      await refetchTemplates();
      
      toast({
        title: "Template Deleted",
        description: `Template "${templateToDelete.name}" has been deleted.`,
      });
      
      // Close dialog and reset state
      setShowDeleteConfirmDialog(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Save template to database
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please enter a template name",
        variant: "destructive",
      });
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
          shadow: filters.shadow,
          rotate: transform.rotate,
          flip_x: transform.flip_x,
          flip_y: transform.flip_y
        }
      };

      await imageEditorTemplatesApi.create(templateData);
      
      // Refresh templates list
      await refetchTemplates();
      
      setShowTemplateDialog(false);
      setTemplateName('');
      
      toast({
        title: "Template Saved",
        description: `Template "${templateData.name}" saved successfully!`,
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
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

      // Downscale huge exports for speed (rotate/crop/save) + smaller uploads.
      const maxExportDim = 2560;
      const srcW = img.naturalWidth || 1;
      const srcH = img.naturalHeight || 1;
      const exportScale = Math.min(1, maxExportDim / Math.max(srcW, srcH));
      const drawW = Math.max(1, Math.round(srcW * exportScale));
      const drawH = Math.max(1, Math.round(srcH * exportScale));
      
      if (isRotated90) {
        canvas.width = drawH;
        canvas.height = drawW;
      } else {
        canvas.width = drawW;
        canvas.height = drawH;
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
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH
      );

      // Reset transforms for final output
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Tonal shadows adjustment (post-process on the rendered pixels)
      applyShadowsAdjustment(ctx, canvas, filters.shadow);

      // Convert to blob and create File
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          
          // Store the editing settings for this image (keyed by itemId/session + stable per-image key)
          if (itemId !== undefined || sessionKeyRef.current) {
            const historyKey = getHistoryKeyForIndex(currentImageIndex);
            
            // Preserve original image URL (first time editing) for future edits
            const existingSettings = imageEditHistoryRef.current.get(historyKey);
            const originalImageUrl = existingSettings?.originalImageUrl || originalImgSrc || imgSrc;
            
            const settingsToSave = {
              filters: { ...filters },
              transform: { ...transform },
              timestamp: Date.now(),
              imageUrl: imgSrc, // Current image URL
              originalImageUrl: originalImageUrl, // Always keep the original for re-editing
              templateId: selectedTemplate || null // Save selected template ID
            };
            console.log('Saving settings with key:', historyKey, 'Settings:', settingsToSave);
            imageEditHistoryRef.current.set(historyKey, settingsToSave);
            
            // Persist to localStorage
            try {
              const serialized = JSON.stringify(Array.from(imageEditHistoryRef.current.entries()));
              localStorage.setItem('imageEditHistory', serialized);
              console.log('Settings saved to localStorage, total keys:', imageEditHistoryRef.current.size);
            } catch (e) {
              console.error('Failed to save edit history to localStorage:', e);
            }
          }
          
          // Mark this image as edited
          setEditedImages(prev => new Set([...prev, currentImageIndex]));
          setHasUnsavedChanges(false);
          
          // Clear temporary unsaved state for this image since it's now saved
          tempImageStateRef.current.delete(currentImageIndex);
          
          if (onSave) {
            onSave(file, currentImageIndex);
          }
          
          // Only close if single image, otherwise stay open for multi-image editing
          if (!hasMultipleImages) {
            onOpenChange(false);
          }
          
          // Show success toast for multi-image
          if (hasMultipleImages) {
            toast({
              title: "Image Saved",
              description: `Image ${currentImageIndex + 1} saved! ${editedImages.size + 1}/${normalizedImages.length} images edited.`,
            });
          }
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error saving image:', error);
      toast({
        title: "Error",
        description: "Failed to save image. Please try again.",
        variant: "destructive",
      });
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
        <DialogContent className="w-[100vw] h-[100dvh] sm:w-[85vw] sm:max-w-[1200px] sm:max-h-[90vh] p-0 overflow-hidden bg-white border-gray-200 flex flex-col shadow-2xl rounded-none sm:rounded-lg">
          <DialogHeader className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 backdrop-blur-sm flex-shrink-0" style={{ paddingTop: '17px', paddingBottom: '17px' }}>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span>Photo Editor</span>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Edit photos with brightness, contrast, saturation, shadows, crop, and rotation. Save changes or apply to all images.
              </DialogDescription>
              
              {/* Apply to All button - Desktop only in header */}
              {hasUnsavedChanges && hasMultipleImages && onApplyToAll && (
                <Button
                  onClick={handleApplyFiltersToAll}
                  className="hidden md:flex absolute right-[60px] top-3 bg-purple-600/80 hover:bg-purple-500 text-white text-xs h-7 px-3"
                  style={{ marginRight: '0px', marginBottom: '0px' }}
                >
                  ✨ Apply to All
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="ant-modal-body flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden p-2 sm:p-4" style={{ scale: 1, outline: 'none' }}>
            {/* Compact Sidebar */}
            <div className="w-full md:w-[220px] bg-gray-50 backdrop-blur-sm md:border-r border-gray-200 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-3 flex-shrink-0 max-h-[30dvh] md:max-h-none order-1">
              {/* Template Section - Compact */}
              <div className="space-y-2">
                <Select
                  value={selectedTemplate || 'none'}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      setSelectedTemplate(null);
                      resetCurrentImage();
                    } else {
                      const template = templates.find(t => t.id === value);
                      if (template) {
                        handleLoadTemplate(template);
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
                            onClick={(e) => handleDeleteTemplate(template.id, template.name, e)}
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
                  onClick={handleSaveTemplateClick}
                  className="w-full bg-indigo-600/80 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 text-xs h-7 sm:h-[41px]"
                >
                  <Save className="w-3 h-3" />
                  <span>Save Template</span>
                </Button>
              </div>

              {/* Upload Section - Compact */}
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
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 flex items-center justify-center gap-1.5 text-xs h-7 border border-gray-300"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload</span>
                </Button>
              </div>

              {/* Transform Section - Compact */}
              <div className="space-y-2">
                {isCropping ? (
                  // When cropping, show aspect ratio selector and crop controls
                  <div className="space-y-2">
                    <Select value={aspectRatio} onValueChange={handleAspectRatioChange}>
                      <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900 text-xs h-7">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="square">Square (1:1)</SelectItem>
                        <SelectItem value="4:3">Landscape (4:3)</SelectItem>
                        <SelectItem value="16:9">Widescreen (16:9)</SelectItem>
                        <SelectItem value="4:5">Portrait (4:5)</SelectItem>
                        <SelectItem value="9:16">Vertical (9:16)</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                      <Button
                        onClick={cancelCrop}
                        className="flex-1 bg-red-600/80 hover:bg-red-500 text-white text-xs h-7"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={applyCrop}
                        className="flex-1 bg-green-600/80 hover:bg-green-500 text-white text-xs h-7"
                      >
                        ✓ Apply
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleTransform('crop')}
                    className="w-full p-2 rounded-md border bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400 transition-all duration-200 flex items-center justify-center gap-1.5 text-xs h-9 sm:h-[54px]"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Crop</span>
                  </button>
                )}

                {/* Adjustments Section - Hidden when cropping */}
                {!isCropping && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                      <span className="capitalize font-medium">{activeFilter}</span>
                      <span className="text-gray-900 font-semibold">{sliderValue}%</span>
                    </div>
                    <div className="relative py-1">
                      {/* Tick marks */}
                      <div className="absolute top-0 left-0 right-0 h-1 flex items-center justify-between pointer-events-none z-0" style={{ marginTop: '6px' }}>
                        {[0, 25, 50, 75, 100, 125, 150, 175, 200].map((tick) => {
                          if (tick < sliderMin || tick > sliderMax) return null;
                          const position = ((tick - sliderMin) / sliderRange) * 100;
                          return (
                            <div
                              key={tick}
                              className="w-0.5 h-1 bg-gray-400"
                              style={{
                                position: 'absolute',
                                left: `${position}%`,
                                transform: 'translateX(-50%)'
                              }}
                            />
                          );
                        })}
                      </div>
                      <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        value={sliderValue}
                        onChange={(e) => {
                          let value = Number(e.target.value);
                          // Snap to nearest tick mark (0, 25, 50, 75, 100) if within 3 units
                          const tickMarks = [0, 25, 50, 75, 100, 125, 150, 175, 200];
                          const nearestTick = tickMarks.reduce((prev, curr) => {
                            return (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);
                          });
                          if (Math.abs(value - nearestTick) <= 3 && nearestTick >= sliderMin && nearestTick <= sliderMax) {
                            value = nearestTick;
                          }
                          handleSliderChange(value);
                        }}
                        className="modern-slider w-full appearance-none cursor-pointer relative z-10"
                        style={{
                          background: sliderRange > 0
                            ? `linear-gradient(to right, rgba(209, 213, 219, 0.6) 0%, rgba(99, 102, 241, 0.8) ${((sliderValue - sliderMin) / sliderRange) * 100}%, rgba(99, 102, 241, 0.8) ${((sliderValue - sliderMin) / sliderRange) * 100}%, rgba(209, 213, 219, 0.6) 100%)`
                            : 'rgba(209, 213, 219, 0.6)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Filters Section - Hidden when cropping */}
                {!isCropping && (
                  <div className="space-y-2">
                    {/* Brightness and Contrast Row */}
                    <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'brightness', icon: BrightnessIcon, label: 'Bright' },
                      { id: 'contrast', icon: Contrast, label: 'Contrast' },
                    ].map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => handleFilterClick(id)}
                        className={`p-1.5 rounded-md border transition-all duration-200 flex flex-col items-center gap-1 ${
                          activeFilter === id
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                            : 'bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[10px] leading-tight">{label}</span>
                      </button>
                    ))}
                    </div>
                    {/* Saturation and Shadow Row */}
                    <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'saturate', icon: Palette, label: 'Saturate' },
                      { id: 'shadow', icon: Layers, label: 'Shadow' },
                    ].map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => handleFilterClick(id)}
                        className={`p-1.5 rounded-md border transition-all duration-200 flex flex-col items-center gap-1 ${
                          activeFilter === id
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                            : 'bg-white border-gray-300 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[10px] leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Action Buttons - Desktop only */}
                  <div className="hidden md:flex flex-col gap-2 pt-2">
                    {/* Reset All - only show when there are changes from ORIGINAL */}
                    {(() => {
                      const canShowResetAll =
                        hasMultipleImages &&
                        currentImageIndex === 0 &&
                        appliedToAll &&
                        normalizedImages.length > 1;

                      const canShowResetCurrent =
                        hasChangesFromOriginal() &&
                        (!appliedToAll || currentImageIndex !== 0 || !hasMultipleImages);

                      // Image 1:
                      // - After Apply-to-All: show only "Reset All"
                      // - Otherwise (single-image edits): show "Reset for Image 1"
                      // Other images:
                      // - Only show "Reset" (this image)
                      if (canShowResetAll) {
                        return (
                          <Button
                            onClick={resetAllImages}
                            className="w-full bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 text-xs h-7"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Reset All</span>
                          </Button>
                        );
                      }

                      if (canShowResetCurrent) {
                        return (
                          <Button
                            onClick={resetCurrentImage}
                            className="w-full bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 text-xs h-7"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Reset</span>
                          </Button>
                        );
                      }

                      return null;
                    })()}
                    
                    {/* Save/Done button */}
                    <Button
                      onClick={(appliedToAll || editedImages.has(currentImageIndex)) && !hasUnsavedChanges ? () => onOpenChange(false) : handleSave}
                      className="w-full bg-green-600/80 hover:bg-green-500 text-white flex items-center justify-center gap-1.5 text-xs h-10 font-medium"
                      style={{ paddingTop: '27px', paddingBottom: '27px', height: '40px' }}
                      disabled={!imgSrc}
                    >
                      <Download className="w-3 h-3" />
                      <span>
                        {(appliedToAll || editedImages.has(currentImageIndex)) && !hasUnsavedChanges
                          ? 'Done' 
                          : hasMultipleImages 
                            ? `Save Image ${currentImageIndex + 1}` 
                            : 'Save Image'}
                      </span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

            {/* Main Content - Image preview */}
            <div className="w-full md:flex-1 flex flex-col min-w-0 flex-1 overflow-hidden bg-transparent dark:bg-transparent mt-2 md:mt-0 md:pl-3 order-2" style={{ scale: 1, outline: 'none' }}>
              <div 
                className={`image-edit-container w-full flex-1 min-h-[58dvh] md:min-h-0 overflow-hidden flex items-center justify-center rounded-lg ${isCropping ? 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700'}`}
                style={{ 
                  scale: 1,
                  outline: 'none'
                }}
              >
                {imgSrc && (
                  <div
                    className="relative flex items-center justify-center pb-24 md:pb-0 pt-3 md:pt-0"
                    style={{ outline: 'none', border: 'none', width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 1)' }}
                  >
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
                            className="image-editor-nav-btn absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white hover:bg-white shadow-xl ring-1 ring-black/5 flex items-center justify-center z-20 transition-all hover:scale-110"
                            title="Previous image"
                          >
                            <ChevronLeft className="w-6 h-6 text-gray-800" />
                          </button>
                        )}

                        {/* Next button */}
                        {currentImageIndex < normalizedImages.length - 1 && (
                          <button
                            onClick={goToNextImage}
                            className="image-editor-nav-btn absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white hover:bg-white shadow-xl ring-1 ring-black/5 flex items-center justify-center z-20 transition-all hover:scale-110"
                            title="Next image"
                          >
                            <ChevronRight className="w-6 h-6 text-gray-800" />
                          </button>
                        )}

                        {/* Image counter */}
                        <div className="absolute top-4 left-4 bg-white/90 text-gray-900 text-sm px-3 py-1.5 rounded-full z-10 border border-gray-200 shadow-md">
                          {currentImageIndex + 1} / {normalizedImages.length}
                        </div>
                      </>
                    )}

                    {isCropping ? (
                      <img
                        ref={imageRef}
                        src={imgSrc}
                        alt="Editor Preview"
                        className="block object-contain"
                        style={{
                          width: '100%',
                          height: '100%',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    ) : (
                      <canvas
                        ref={previewCanvasRef}
                        aria-label="Editor Preview"
                        className="block object-contain"
                        style={{
                          width: '100%',
                          height: '100%',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    )}
                    
                    {/* Rotate buttons overlay - always visible */}
                    <div style={{
                      position: 'absolute',
                      // Keep above the mobile footer buttons (Reset/Apply/Save)
                      bottom: isMobile ? 'calc(env(safe-area-inset-bottom, 0px) + 132px)' : '12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      gap: '8px',
                      zIndex: 2000
                    }}>
                      <button
                        onClick={() => handleTransform('rotate_left')}
                        className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white hover:bg-gray-50 border border-gray-300 shadow-md hover:shadow-lg flex items-center justify-center transition-all hover:scale-105"
                        style={{
                          borderColor: 'rgba(209, 213, 219, 1)',
                          boxShadow: '0px 1px 10px 4px rgba(0, 0, 0, 0.1), 0px 0px 0px 0px rgba(0, 0, 0, 0), 0px 4px 6px -1px rgba(0, 0, 0, 0.05), 0px 2px 4px -2px rgba(0, 0, 0, 0.05)'
                        }}
                        title="Rotate Left"
                      >
                        <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => handleTransform('rotate_right')}
                        className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white hover:bg-gray-50 border border-gray-300 shadow-md hover:shadow-lg flex items-center justify-center transition-all hover:scale-105"
                        style={{
                          borderColor: 'rgba(209, 213, 219, 1)',
                          boxShadow: '0px 1px 10px 4px rgba(0, 0, 0, 0.1), 0px 0px 0px 0px rgba(0, 0, 0, 0), 0px 4px 6px -1px rgba(0, 0, 0, 0.05), 0px 2px 4px -2px rgba(0, 0, 0, 0.05)'
                        }}
                        title="Rotate Right"
                      >
                        <RotateCw className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-700" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {isCropping && (
                <div className="mt-3 text-center text-gray-700 text-sm bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  <p className="font-medium">✨ Drag the crop box or resize using the corners and edges</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer - Mobile only */}
          <div className="md:hidden px-4 py-2.5 border-t border-gray-200 bg-gray-50 backdrop-blur-sm flex flex-col gap-2 flex-shrink-0">
            {/* Reset All - only show when there are changes from ORIGINAL */}
            {(() => {
              const canShowResetAll =
                hasMultipleImages &&
                currentImageIndex === 0 &&
                appliedToAll &&
                normalizedImages.length > 1;

              const canShowResetCurrent =
                hasChangesFromOriginal() &&
                (!appliedToAll || currentImageIndex !== 0 || !hasMultipleImages);

              if (canShowResetAll) {
                return (
                  <Button
                    onClick={resetAllImages}
                    className="flex-1 bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 text-xs h-7"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Reset All</span>
                  </Button>
                );
              }

              if (canShowResetCurrent) {
                return (
                  <Button
                    onClick={resetCurrentImage}
                    className="flex-1 bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 text-xs h-7"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Reset</span>
                  </Button>
                );
              }

              return null;
            })()}
            
            {/* Apply to All button - Mobile only in footer */}
            {hasUnsavedChanges && hasMultipleImages && onApplyToAll && (
              <Button
                onClick={handleApplyFiltersToAll}
                className="flex-1 bg-purple-600/80 hover:bg-purple-500 text-white text-xs h-7"
              >
                ✨ Apply to All
              </Button>
            )}
            
            {/* Save/Done button - Mobile only */}
            {!isCropping && (
              <Button
                onClick={(appliedToAll || editedImages.has(currentImageIndex)) && !hasUnsavedChanges ? () => onOpenChange(false) : handleSave}
                className="flex-1 bg-green-600/80 hover:bg-green-500 text-white flex items-center justify-center gap-1.5 text-xs h-7"
                disabled={!imgSrc}
              >
                <Download className="w-3 h-3" />
                <span>
                  {(appliedToAll || editedImages.has(currentImageIndex)) && !hasUnsavedChanges
                    ? 'Done' 
                    : hasMultipleImages 
                      ? `Save ${currentImageIndex + 1}` 
                      : 'Save'}
                </span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Name Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Save Template</DialogTitle>
            <DialogDescription className="text-gray-600">
              Give your image adjustment template a name so you can use it again later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name" className="text-gray-900">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Bright & Vibrant"
                className="bg-white border-gray-300 text-gray-900"
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
              className="border-gray-300 text-gray-900 hover:bg-gray-100"
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

      {/* Delete Template Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the template "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Public wrapper: do not mount the heavy editor (and its hooks) unless open.
export function ImageEditor(props) {
  if (!props?.open) return null;
  return <ImageEditorInner {...props} />;
}

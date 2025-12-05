import React, { useState, useEffect, useRef } from 'react';
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
  X
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
 */
export function ImageEditor({ open, onOpenChange, imageSrc, onSave, fileName = 'edited-image.jpg' }) {
  const [imgSrc, setImgSrc] = useState(null);
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
  
  const imageRef = useRef(null);
  const cropperInstanceRef = useRef(null);
  const queryClient = useQueryClient();

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

  // Load image when component opens or imageSrc changes
  useEffect(() => {
    if (open && imageSrc) {
      setImgSrc(imageSrc);
      
      // Clean up existing cropper
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
      
      // Reset all settings (don't load template on image change)
      resetAll();
    }
    return () => {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
    };
  }, [open, imageSrc]);

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
        cropperInstanceRef.current = new Cropper(imageRef.current, {
          aspectRatio: getAspectRatioValue(),
          viewMode: 1,
          dragMode: 'none',
          autoCropArea: 0.8,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          responsive: true,
          checkOrientation: false,
          modal: true,
          background: true,
          zoomable: false,
          zoomOnTouch: false,
          zoomOnWheel: false,
          scalable: false,
          movable: false,
          rotatable: false,
        });
        setCropper(cropperInstanceRef.current);
        setIsCropping(true);
      } catch (error) {
        console.error('Error initializing cropper:', error);
        alert('Failed to initialize crop tool: ' + error.message);
      }
    }
  };

  // Apply shadows using canvas manipulation
  const applyShadows = (ctx, width, height, shadowValue) => {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Shadow adjustment: -100 (darken) to +100 (lighten)
      const adjustment = shadowValue / 100;
      
      for (let i = 0; i < data.length; i += 4) {
        if (adjustment < 0) {
          // Darken shadows
          const factor = 1 + adjustment;
          data[i] = Math.max(0, Math.min(255, data[i] * factor)); // R
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor)); // G
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor)); // B
        } else {
          // Lighten shadows
          data[i] = Math.max(0, Math.min(255, data[i] + (255 - data[i]) * adjustment)); // R
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (255 - data[i + 1]) * adjustment)); // G
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (255 - data[i + 2]) * adjustment)); // B
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.warn('Could not apply shadow adjustment:', error);
    }
  };

  // Update image filter styles (for preview only)
  useEffect(() => {
    if (imageRef.current && !isCropping) {
      const filterStyle = `brightness(${filters.brightness}%) 
                          contrast(${filters.contrast}%) 
                          saturate(${filters.saturate}%)`;
      
      const transformStyle = `rotate(${transform.rotate}deg) scale(${transform.flip_x}, ${transform.flip_y})`;
      
      imageRef.current.style.filter = filterStyle;
      imageRef.current.style.transform = transformStyle;
      
      // Note: Shadows are applied during final save, not in preview
    }
  }, [filters, transform, isCropping]);

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
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Apply filters
      ctx.filter = `brightness(${filters.brightness}%) 
                   contrast(${filters.contrast}%) 
                   saturate(${filters.saturate}%)`;

      // Apply transforms
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(transform.flip_x, transform.flip_y);
      ctx.rotate((transform.rotate * Math.PI) / 180);
      ctx.drawImage(
        img,
        -canvas.width / 2,
        -canvas.height / 2,
        canvas.width,
        canvas.height
      );

      // Apply shadows
      if (filters.shadows !== 0) {
        applyShadows(ctx, canvas.width, canvas.height, filters.shadows);
      }

      // Convert to blob and create File
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          if (onSave) {
            onSave(file);
          }
          onOpenChange(false);
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Failed to save image. Please try again.');
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy();
      cropperInstanceRef.current = null;
    }
    resetAll();
    onOpenChange(false);
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
        <DialogContent className="w-[92vw] sm:w-[90vw] max-w-[95vw] max-h-[90vh] p-0 overflow-hidden overflow-x-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <DialogHeader className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base sm:text-xl font-semibold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-xl">Advanced Photo Editor</span>
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-col md:flex-row h-[calc(90vh-120px)] sm:h-[calc(90vh-140px)] overflow-hidden">
            {/* Sidebar */}
            <div className="w-full md:w-[300px] bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 overflow-y-auto overflow-x-hidden p-2 sm:p-4 space-y-3 sm:space-y-6 max-h-full">
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
                <h3 className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-2">
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
                <h3 className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Crop className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Transform
                </h3>
                
                {/* Aspect Ratio Selector - shown when cropping or before cropping */}
                {!isCropping && (
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
                )}

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
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {[
                      { id: 'crop', icon: Crop, label: 'Crop' },
                      { id: 'rotate_left', icon: RotateCcw, label: 'Rotate Left' },
                      { id: 'rotate_right', icon: RotateCw, label: 'Rotate Right' },
                    ].map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => handleTransform(id)}
                        className="p-2 sm:p-3 rounded-lg border bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-600/50 transition-all duration-300 flex flex-col items-center gap-1 sm:gap-2"
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-[10px] sm:text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Adjustments Section */}
                <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                  <h3 className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-2">
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

                {/* Filters Section */}
                <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                  <h3 className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-2">
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
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-slate-900/50 overflow-hidden min-w-0 max-h-full p-2 sm:p-4">
              <div className="w-full flex-1 rounded-lg bg-slate-950 border border-slate-700 overflow-hidden" style={{ position: 'relative', minHeight: '600px', height: '100%' }}>
                {imgSrc && (
                <img
                  ref={imageRef}
                  src={imgSrc}
                  alt="Editor Preview"
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: isCropping ? 'none' : `brightness(${filters.brightness}%) 
                              contrast(${filters.contrast}%) 
                              saturate(${filters.saturate}%)`,
                    transform: isCropping ? 'none' : `rotate(${transform.rotate}deg) scale(${transform.flip_x}, ${transform.flip_y})`
                  }}
                  />
                )}
              </div>
              {isCropping && (
                <div className="mt-3 text-center text-slate-300 text-sm">
                  <p>📐 Drag the crop box to adjust your selection. Use the controls on the left to apply or cancel.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 sm:px-5 py-2 sm:py-4 border-t border-slate-700/50 bg-slate-800/50 backdrop-blur-sm flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
            <Button
              onClick={resetAll}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-base">Reset All</span>
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 text-sm sm:text-base"
            >
              <span className="text-xs sm:text-base">Cancel</span>
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-2 text-sm sm:text-base"
              disabled={!imgSrc}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-base">Save Image</span>
            </Button>
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

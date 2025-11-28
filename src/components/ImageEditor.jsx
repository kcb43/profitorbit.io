import React, { useState, useEffect, useRef } from 'react';
import Cropper from 'cropperjs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Camera, 
  Moon, 
  Sun, 
  Upload, 
  SlidersHorizontal,
  Sparkles,
  Crop,
  RotateCcw, 
  RotateCw, 
  MoveHorizontal, 
  MoveVertical,
  Sun as BrightnessIcon,
  Contrast,
  Palette,
  Replace,
  Droplets,
  CircleDot,
  Image as ImageIcon,
  Rainbow,
  Circle,
  Brush,
  Grid3x3,
  Undo2,
  Download
} from 'lucide-react';

/**
 * Advanced Image Editor Component
 * Provides comprehensive image editing capabilities with filters, transforms, and effects
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
    invert: 0,
    blur: 0,
    grayscale: 0,
    sepia: 0,
    hue: 0,
    noise: 0,
    pixelate: 0,
    vignette: 0
  });
  const [transform, setTransform] = useState({
    rotate: 0,
    flip_x: 1,
    flip_y: 1
  });
  const [activeFilter, setActiveFilter] = useState('brightness');
  const [cropper, setCropper] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showCropBtn, setShowCropBtn] = useState(false);
  const [croppedPreview, setCroppedPreview] = useState(null);
  
  const imageRef = useRef(null);
  const cropperInstanceRef = useRef(null);

  // Load image when component opens or imageSrc changes
  useEffect(() => {
    if (open && imageSrc) {
      setImgSrc(imageSrc);
      
      // Clean up existing cropper
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
      
      // Reset all settings
      resetAll();
      
      // Wait for image to load before initializing cropper
      if (imageRef.current) {
        const img = imageRef.current;
        if (img.complete) {
          setTimeout(() => initCropper(), 100);
        } else {
          img.onload = () => {
            setTimeout(() => initCropper(), 100);
          };
        }
      }
    }
    return () => {
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy();
        cropperInstanceRef.current = null;
      }
    };
  }, [open, imageSrc]);

  // Initialize Cropper.js
  const initCropper = () => {
    if (imageRef.current && !cropperInstanceRef.current) {
      try {
        cropperInstanceRef.current = new Cropper(imageRef.current, {
          aspectRatio: NaN,
          viewMode: 2,
          dragMode: 'move',
          autoCropArea: 1,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
        });
        setCropper(cropperInstanceRef.current);
      } catch (error) {
        console.error('Error initializing cropper:', error);
      }
    }
  };

  // Update image filter styles
  useEffect(() => {
    if (imageRef.current && cropperInstanceRef.current) {
      const filterStyle = `brightness(${filters.brightness}%) 
                          contrast(${filters.contrast}%) 
                          saturate(${filters.saturate}%) 
                          invert(${filters.invert}%) 
                          blur(${filters.blur}px)
                          grayscale(${filters.grayscale}%)
                          sepia(${filters.sepia}%)
                          hue-rotate(${filters.hue}deg)`;
      
      const transformStyle = `rotate(${transform.rotate}deg) scale(${transform.flip_x}, ${transform.flip_y})`;
      
      imageRef.current.style.filter = filterStyle;
      imageRef.current.style.transform = transformStyle;
    }
  }, [filters, transform]);

  // Get slider max value based on active filter
  const getSliderMax = () => {
    switch (activeFilter) {
      case 'brightness':
      case 'contrast':
      case 'saturate':
        return 200;
      case 'hue':
        return 360;
      default:
        return 100;
    }
  };

  // Get slider value for active filter
  const getSliderValue = () => {
    return filters[activeFilter] || 0;
  };

  // Handle filter button click
  const handleFilterClick = (filterName) => {
    setActiveFilter(filterName);
  };

  // Handle slider change
  const handleSliderChange = (value) => {
    setFilters(prev => ({
      ...prev,
      [activeFilter]: value
    }));
  };

  // Handle transform buttons
  const handleTransform = (type) => {
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
        cropImage();
        break;
    }
  };

  // Crop image
  const cropImage = () => {
    if (!cropperInstanceRef.current) {
      // Initialize cropper if not already initialized
      initCropper();
      setShowCropBtn(true);
      return;
    }
    
    try {
      const canvas = cropperInstanceRef.current.getCroppedCanvas();
      if (canvas) {
        const dataUrl = canvas.toDataURL();
        const oldCropper = cropperInstanceRef.current;
        
        // Destroy old cropper
        oldCropper.destroy();
        cropperInstanceRef.current = null;
        setShowCropBtn(false);
        
        // Update image source
        setImgSrc(dataUrl);
        setCroppedPreview(dataUrl);
        
        // Reinitialize cropper with new image after it loads
        setTimeout(() => {
          if (imageRef.current) {
            const img = imageRef.current;
            if (img.complete) {
              initCropper();
            } else {
              img.onload = () => {
                initCropper();
              };
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
      alert('Failed to crop image. Please try again.');
    }
  };

  // Reset all filters and transforms
  const resetAll = () => {
    setFilters({
      brightness: 100,
      contrast: 100,
      saturate: 100,
      invert: 0,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      hue: 0,
      noise: 0,
      pixelate: 0,
      vignette: 0
    });
    setTransform({
      rotate: 0,
      flip_x: 1,
      flip_y: 1
    });
    setActiveFilter('brightness');
    setCroppedPreview(null);
    setShowCropBtn(false);
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

  // Apply noise effect
  const applyNoise = (ctx, width, height, intensity) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);
  };

  // Apply pixelate effect
  const applyPixelate = (ctx, width, height, intensity) => {
    const size = Math.max(1, Math.floor(intensity / 10));
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(ctx.canvas, 0, 0);

    ctx.clearRect(0, 0, width, height);
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        const pixel = tempCtx.getImageData(x, y, 1, 1).data;
        ctx.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        ctx.fillRect(x, y, size, size);
      }
    }
  };

  // Apply vignette effect
  const applyVignette = (ctx, width, height, intensity) => {
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) / 2
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity / 100})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  // Save edited image
  const handleSave = async () => {
    if (!imgSrc) return;

    try {
      // Create image element
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
                   saturate(${filters.saturate}%) 
                   invert(${filters.invert}%) 
                   blur(${filters.blur}px)
                   grayscale(${filters.grayscale}%)
                   sepia(${filters.sepia}%)
                   hue-rotate(${filters.hue}deg)`;

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

      // Apply effects
      if (filters.noise > 0) {
        applyNoise(ctx, canvas.width, canvas.height, filters.noise);
      }
      if (filters.pixelate > 0) {
        applyPixelate(ctx, canvas.width, canvas.height, filters.pixelate);
      }
      if (filters.vignette > 0) {
        applyVignette(ctx, canvas.width, canvas.height, filters.vignette);
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
    // Clean up cropper
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
  const sliderValue = getSliderValue();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] p-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <DialogHeader className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Advanced Photo Editor
            </DialogTitle>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-600/50 transition-all duration-300 hover:rotate-180"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-white" /> : <Moon className="w-4 h-4 text-white" />}
            </button>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-[calc(95vh-140px)] overflow-hidden">
          {/* Sidebar */}
          <div className="w-full md:w-[300px] bg-slate-800/50 backdrop-blur-sm border-r border-slate-700/50 overflow-y-auto p-4 space-y-6">
            {/* Upload Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Upload className="w-4 h-4" />
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
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Image</span>
                </Button>
              </div>
            </div>

            {/* Adjustments Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Adjustments
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="capitalize">{activeFilter}</span>
                  <span>{sliderValue}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={sliderMax}
                  value={sliderValue}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #6c5ce7 0%, #6c5ce7 ${(sliderValue / sliderMax) * 100}%, #475569 ${(sliderValue / sliderMax) * 100}%, #475569 100%)`
                  }}
                />
              </div>
            </div>

            {/* Filters Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Filters
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'brightness', icon: BrightnessIcon, label: 'Brightness' },
                  { id: 'contrast', icon: Contrast, label: 'Contrast' },
                  { id: 'saturate', icon: Palette, label: 'Saturation' },
                  { id: 'invert', icon: Replace, label: 'Invert' },
                  { id: 'blur', icon: Droplets, label: 'Blur' },
                  { id: 'grayscale', icon: CircleDot, label: 'Grayscale' },
                  { id: 'sepia', icon: ImageIcon, label: 'Sepia' },
                  { id: 'hue', icon: Rainbow, label: 'Hue' },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => handleFilterClick(id)}
                    className={`p-3 rounded-lg border transition-all duration-300 flex flex-col items-center gap-2 ${
                      activeFilter === id
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-600/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Transform Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Crop className="w-4 h-4" />
                Transform
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'rotate_left', icon: RotateCcw, label: 'Rotate Left' },
                  { id: 'rotate_right', icon: RotateCw, label: 'Rotate Right' },
                  { id: 'flip_x', icon: MoveHorizontal, label: 'Flip H' },
                  { id: 'flip_y', icon: MoveVertical, label: 'Flip V' },
                  { id: 'crop', icon: Crop, label: 'Crop' },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => handleTransform(id)}
                    className="p-3 rounded-lg border bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-600/50 transition-all duration-300 flex flex-col items-center gap-2"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Effects Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Effects
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'vignette', icon: Circle, label: 'Vignette' },
                  { id: 'noise', icon: Brush, label: 'Noise' },
                  { id: 'pixelate', icon: Grid3x3, label: 'Pixelate' },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => handleFilterClick(id)}
                    className={`p-3 rounded-lg border transition-all duration-300 flex flex-col items-center gap-2 ${
                      activeFilter === id
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-600/50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-900/50 overflow-hidden">
            <div className="w-full h-full max-h-full flex items-center justify-center overflow-hidden rounded-lg bg-slate-950 border border-slate-700">
              {imgSrc && (
                <img
                  ref={imageRef}
                  src={imgSrc}
                  alt="Editor Preview"
                  className="max-w-full max-h-full object-contain"
                  style={{
                    filter: `brightness(${filters.brightness}%) 
                            contrast(${filters.contrast}%) 
                            saturate(${filters.saturate}%) 
                            invert(${filters.invert}%) 
                            blur(${filters.blur}px)
                            grayscale(${filters.grayscale}%)
                            sepia(${filters.sepia}%)
                            hue-rotate(${filters.hue}deg)`,
                    transform: `rotate(${transform.rotate}deg) scale(${transform.flip_x}, ${transform.flip_y})`
                  }}
                />
              )}
            </div>
            {showCropBtn && (
              <Button
                onClick={cropImage}
                className="mt-4 bg-green-600 hover:bg-green-500 text-white"
              >
                Apply Crop
              </Button>
            )}
            {croppedPreview && (
              <img
                src={croppedPreview}
                alt="Cropped Preview"
                className="mt-4 max-w-[200px] rounded-lg border-2 border-slate-600"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700/50 bg-slate-800/50 backdrop-blur-sm flex gap-3">
          <Button
            onClick={resetAll}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2"
          >
            <Undo2 className="w-4 h-4" />
            Reset All
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white flex items-center justify-center gap-2"
            disabled={!imgSrc}
          >
            <Download className="w-4 h-4" />
            Save Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

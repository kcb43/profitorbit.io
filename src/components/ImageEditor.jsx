import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RotateCw, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Image Editor Component
 * Provides image editing capabilities: brightness, contrast, crop, and rotation
 * 
 * @param {boolean} open - Whether the editor dialog is open
 * @param {function} onOpenChange - Callback when dialog open state changes
 * @param {string} imageSrc - Source URL of the image to edit (blob URL or URL)
 * @param {function} onSave - Callback when user saves edited image (receives File object)
 * @param {string} fileName - Optional filename for the saved image
 */
export function ImageEditor({ open, onOpenChange, imageSrc, onSave, fileName = 'edited-image.jpg' }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100); // 0-200, 100 = normal
  const [contrast, setContrast] = useState(100); // 0-200, 100 = normal
  const [shadows, setShadows] = useState(0); // -100 to 100, 0 = normal
  const [sharpness, setSharpness] = useState(0); // -100 to 100, 0 = normal
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspect, setAspect] = useState(1); // Default to 1:1 (square) as recommended
  const [isProcessing, setIsProcessing] = useState(false);
  const [filteredImageSrc, setFilteredImageSrc] = useState(null);
  const canvasRef = useRef(null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setShadows(0);
    setSharpness(0);
    setAspect(1); // Reset to recommended square
  };

  const handleRotate = (direction) => {
    setRotation(prev => {
      const newRotation = direction === 'cw' ? prev + 90 : prev - 90;
      // Normalize to -180 to 180 range
      return ((newRotation % 360) + 360) % 360 > 180 
        ? ((newRotation % 360) + 360) % 360 - 360 
        : ((newRotation % 360) + 360) % 360;
    });
  };

  // Create filtered preview image for live preview
  React.useEffect(() => {
    if (!imageSrc) {
      setFilteredImageSrc(null);
      return;
    }

    const createFilteredPreview = async () => {
      try {
        let image;
        try {
          image = await createImage(imageSrc);
        } catch (error) {
          console.error('Error loading image for preview:', error);
          setFilteredImageSrc(imageSrc); // Fallback to original
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setFilteredImageSrc(imageSrc);
          return;
        }

        // Apply brightness, contrast, shadows, and sharpness
        const brightnessValue = brightness / 100;
        const contrastValue = contrast / 100;
        // Shadows: negative values darken, positive values lighten
        const shadowAdjustment = shadows / 100;
        // Sharpness: positive values sharpen, negative values blur
        const sharpnessValue = sharpness / 100;
        
        // Apply filters
        ctx.filter = `brightness(${brightnessValue}) contrast(${contrastValue})`;
        ctx.drawImage(image, 0, 0);
        
        // Apply sharpness using convolution
        if (sharpnessValue !== 0) {
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const width = canvas.width;
            const height = canvas.height;
            
            // Create a copy for sharpening/blurring
            const tempData = new Uint8ClampedArray(data);
            
            // Apply unsharp mask for sharpening or blur for negative values
            if (sharpnessValue > 0) {
              // Sharpening kernel
              const kernel = [
                0, -sharpnessValue * 0.5, 0,
                -sharpnessValue * 0.5, 1 + sharpnessValue * 2, -sharpnessValue * 0.5,
                0, -sharpnessValue * 0.5, 0
              ];
              
              for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                  for (let c = 0; c < 3; c++) { // RGB channels
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                      for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        const kidx = (ky + 1) * 3 + (kx + 1);
                        sum += data[idx] * kernel[kidx];
                      }
                    }
                    const idx = (y * width + x) * 4 + c;
                    tempData[idx] = Math.max(0, Math.min(255, sum));
                  }
                }
              }
            } else if (sharpnessValue < 0) {
              // Blur (simple box blur)
              const blurAmount = Math.abs(sharpnessValue);
              for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                  for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    let count = 0;
                    const radius = Math.floor(blurAmount * 2);
                    for (let ky = -radius; ky <= radius; ky++) {
                      for (let kx = -radius; kx <= radius; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        if (idx >= 0 && idx < data.length) {
                          sum += data[idx];
                          count++;
                        }
                      }
                    }
                    const idx = (y * width + x) * 4 + c;
                    tempData[idx] = count > 0 ? sum / count : data[idx];
                  }
                }
              }
            }
            
            // Copy back the processed data
            for (let i = 0; i < data.length; i++) {
              data[i] = tempData[i];
            }
            
            ctx.putImageData(imageData, 0, 0);
          } catch (e) {
            console.warn('Could not apply sharpness adjustment:', e);
          }
        }

        // Apply shadow adjustment by manipulating pixel data
        if (shadowAdjustment !== 0) {
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
              // Adjust RGB channels for shadow effect
              if (shadowAdjustment < 0) {
                // Darken (shadows)
                const factor = 1 + shadowAdjustment;
                data[i] = Math.max(0, Math.min(255, data[i] * factor)); // R
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor)); // G
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor)); // B
              } else {
                // Lighten (highlights)
                const factor = shadowAdjustment;
                data[i] = Math.max(0, Math.min(255, data[i] + (255 - data[i]) * factor)); // R
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (255 - data[i + 1]) * factor)); // G
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (255 - data[i + 2]) * factor)); // B
              }
            }
            
            ctx.putImageData(imageData, 0, 0);
          } catch (e) {
            // If pixel manipulation fails (CORS), just use brightness/contrast
            console.warn('Could not apply shadow adjustment:', e);
          }
        }

        // Convert to data URL for preview
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setFilteredImageSrc(dataUrl);
      } catch (error) {
        console.error('Error creating filtered preview:', error);
        setFilteredImageSrc(imageSrc); // Fallback to original
      }
    };

    createFilteredPreview();
  }, [imageSrc, brightness, contrast, shadows, sharpness]);

  // Convert blob URL to data URL to avoid CORS issues
  const blobToDataURL = (blobUrl) => {
    return new Promise((resolve, reject) => {
      fetch(blobUrl)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    });
  };

  // Create edited image with filters and cropping
  const createImage = async (url) => {
    // If it's a blob URL, convert to data URL to avoid CORS issues
    let imageUrl = url;
    if (url && url.startsWith('blob:')) {
      try {
        imageUrl = await blobToDataURL(url);
      } catch (error) {
        console.warn('Failed to convert blob to data URL, using original:', error);
        // Continue with blob URL if conversion fails
      }
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      
      // Handle CORS - set crossOrigin for external images
      // Blob URLs, data URLs, and same-origin URLs don't need crossOrigin
      if (imageUrl && !imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
        // Check if it's a same-origin URL
        try {
          const urlObj = new URL(imageUrl, window.location.origin);
          const isSameOrigin = urlObj.origin === window.location.origin;
          if (!isSameOrigin) {
            image.crossOrigin = 'anonymous';
          }
        } catch (e) {
          // Invalid URL, try with crossOrigin anyway
          image.crossOrigin = 'anonymous';
        }
      }
      
      image.addEventListener('load', () => {
        // Verify image loaded correctly
        if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
          resolve(image);
        } else {
          reject(new Error('Image failed to load completely'));
        }
      });
      
      image.addEventListener('error', (error) => {
        // If CORS fails, try without crossOrigin (for same-origin images)
        if (image.crossOrigin && imageUrl && !imageUrl.startsWith('data:')) {
          const fallbackImage = new Image();
          fallbackImage.addEventListener('load', () => {
            if (fallbackImage.complete && fallbackImage.naturalWidth > 0 && fallbackImage.naturalHeight > 0) {
              resolve(fallbackImage);
            } else {
              reject(new Error('Image failed to load completely'));
            }
          });
          fallbackImage.addEventListener('error', (err) => reject(err));
          fallbackImage.src = imageUrl;
        } else {
          reject(new Error(`Failed to load image: ${error.message || 'Unknown error'}`));
        }
      });
      
      image.src = imageUrl;
    });
  };

  const getRadianAngle = (degreeValue) => {
    return (degreeValue * Math.PI) / 180;
  };

  const rotateSize = (width, height, rotation) => {
    const rotRad = getRadianAngle(rotation);
    return {
      width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
      height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
  };

  const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0, brightness = 100, contrast = 100, shadows = 0, sharpness = 0) => {
    let image;
    try {
      image = await createImage(imageSrc);
    } catch (error) {
      console.error('Error loading image:', error);
      throw new Error('Failed to load image. This may be due to CORS restrictions. Please ensure the image is from the same origin or has proper CORS headers.');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    const rotRad = getRadianAngle(rotation);

    // Calculate bounding box of the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

    // Set canvas size to match the bounding box
    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    // Translate canvas context to a central location
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    // Apply brightness and contrast filters
    const brightnessValue = brightness / 100; // Convert 0-200 to 0-2
    const contrastValue = contrast / 100; // Convert 0-200 to 0-2
    ctx.filter = `brightness(${brightnessValue}) contrast(${contrastValue})`;

    // Draw the rotated image
    try {
      ctx.drawImage(image, 0, 0);
      
      // Test if canvas is tainted after drawing
      let canManipulatePixels = true;
      try {
        ctx.getImageData(0, 0, 1, 1);
      } catch (e) {
        if (e.name === 'SecurityError' || e.code === 18) {
          throw new Error('Cannot edit this image due to CORS restrictions. Please use an image from your local device or ensure proper CORS headers are set on the image server.');
        }
        canManipulatePixels = false;
      }

      // Apply shadow and sharpness adjustments if possible
      if ((shadows !== 0 || sharpness !== 0) && canManipulatePixels) {
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const width = canvas.width;
          const height = canvas.height;
          
          // Apply shadow adjustment
          if (shadows !== 0) {
            const shadowAdjustment = shadows / 100;
            for (let i = 0; i < data.length; i += 4) {
              // Adjust RGB channels for shadow effect
              if (shadowAdjustment < 0) {
                // Darken (shadows)
                const factor = 1 + shadowAdjustment;
                data[i] = Math.max(0, Math.min(255, data[i] * factor)); // R
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor)); // G
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor)); // B
              } else {
                // Lighten (highlights)
                const factor = shadowAdjustment;
                data[i] = Math.max(0, Math.min(255, data[i] + (255 - data[i]) * factor)); // R
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + (255 - data[i + 1]) * factor)); // G
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + (255 - data[i + 2]) * factor)); // B
              }
            }
          }
          
          // Apply sharpness
          if (sharpness !== 0) {
            const sharpnessValue = sharpness / 100;
            const tempData = new Uint8ClampedArray(data);
            
            if (sharpnessValue > 0) {
              // Sharpening
              const kernel = [
                0, -sharpnessValue * 0.5, 0,
                -sharpnessValue * 0.5, 1 + sharpnessValue * 2, -sharpnessValue * 0.5,
                0, -sharpnessValue * 0.5, 0
              ];
              
              for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                  for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                      for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        const kidx = (ky + 1) * 3 + (kx + 1);
                        sum += data[idx] * kernel[kidx];
                      }
                    }
                    const idx = (y * width + x) * 4 + c;
                    tempData[idx] = Math.max(0, Math.min(255, sum));
                  }
                }
              }
            } else {
              // Blur
              const blurAmount = Math.abs(sharpnessValue);
              const radius = Math.floor(blurAmount * 2);
              for (let y = radius; y < height - radius; y++) {
                for (let x = radius; x < width - radius; x++) {
                  for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    let count = 0;
                    for (let ky = -radius; ky <= radius; ky++) {
                      for (let kx = -radius; kx <= radius; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        sum += data[idx];
                        count++;
                      }
                    }
                    const idx = (y * width + x) * 4 + c;
                    tempData[idx] = count > 0 ? sum / count : data[idx];
                  }
                }
              }
            }
            
            // Copy processed data back
            for (let i = 0; i < data.length; i++) {
              data[i] = tempData[i];
            }
          }
          
          ctx.putImageData(imageData, 0, 0);
        } catch (e) {
          console.warn('Could not apply adjustments to final image:', e);
          // Continue without adjustments
        }
      }
    } catch (error) {
      console.error('Error drawing image to canvas:', error);
      if (error.message && error.message.includes('CORS')) {
        throw error;
      }
      throw new Error('Failed to process image. This may be due to CORS restrictions or an invalid image format.');
    }

    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');

    if (!croppedCtx) {
      throw new Error('No 2d context');
    }

    // Set the size of the cropped canvas
    croppedCanvas.width = pixelCrop.width;
    croppedCanvas.height = pixelCrop.height;

    // Draw the cropped image
    croppedCtx.drawImage(
      canvas,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      croppedCanvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        resolve(file);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        brightness,
        contrast,
        shadows,
        sharpness
      );

      if (croppedImage && onSave) {
        onSave(croppedImage);
        onOpenChange(false);
        handleReset(); // Reset for next use
      }
    } catch (error) {
      console.error('Error processing image:', error);
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to process image. Please try again with a different image.';
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-screen sm:max-h-[95vh] overflow-hidden flex flex-col p-0 w-[95vw] sm:w-full">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Crop Area */}
          <div className="relative bg-black flex-shrink-0 h-[250px] sm:h-[300px] md:h-[350px] max-h-[40vh] sm:max-h-[45vh] md:max-h-none">
            <Cropper
              image={filteredImageSrc || imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              cropShape="rect"
              showGrid={true}
            />
          </div>

          {/* Controls - Scrollable with all editing options */}
          <div className="px-4 sm:px-6 py-4 border-t space-y-4 overflow-y-auto bg-background flex-1 min-h-0">
            {/* Aspect Ratio */}
            <div>
              <Label className="text-sm mb-2 block">Crop Aspect Ratio</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={aspect === 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAspect(1)}
                  className="relative"
                >
                  1:1
                  {aspect === 1 && <span className="ml-1 text-xs opacity-75">(Recommended)</span>}
                </Button>
                <Button
                  type="button"
                  variant={aspect === 4 / 3 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAspect(4 / 3)}
                >
                  4:3
                </Button>
                <Button
                  type="button"
                  variant={aspect === 16 / 9 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAspect(16 / 9)}
                >
                  16:9
                </Button>
                <Button
                  type="button"
                  variant={aspect === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAspect(null)}
                >
                  Free
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                1:1 (Square) is recommended for all platforms
              </p>
            </div>

            {/* Zoom */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Zoom</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom(prev => Math.max(1, prev - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Slider
                value={[zoom]}
                onValueChange={([value]) => setZoom(value)}
                min={1}
                max={3}
                step={0.1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center mt-1">{zoom.toFixed(1)}x</div>
            </div>

            {/* Rotation */}
            <div>
              <Label className="text-sm mb-2 block">Rotation</Label>
              <div className="flex gap-2 items-center justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRotate('ccw')}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Rotate Left
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {rotation}°
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRotate('cw')}
                  className="flex items-center gap-2"
                >
                  <RotateCw className="h-4 w-4" />
                  Rotate Right
                </Button>
              </div>
            </div>

            {/* Brightness */}
            <div>
              <Label className="text-sm mb-2 block">Brightness</Label>
              <Slider
                value={[brightness]}
                onValueChange={([value]) => setBrightness(value)}
                min={0}
                max={200}
                step={1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center mt-1">{brightness}%</div>
            </div>

            {/* Contrast */}
            <div>
              <Label className="text-sm mb-2 block">Contrast</Label>
              <Slider
                value={[contrast]}
                onValueChange={([value]) => setContrast(value)}
                min={0}
                max={200}
                step={1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center mt-1">{contrast}%</div>
            </div>

            {/* Shadows */}
            <div>
              <Label className="text-sm mb-2 block">Shadows</Label>
              <Slider
                value={[shadows]}
                onValueChange={([value]) => setShadows(value)}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center mt-1">
                {shadows > 0 ? `+${shadows}` : shadows} (Left: Darken, Right: Lighten)
              </div>
            </div>

            {/* Sharpness */}
            <div>
              <Label className="text-sm mb-2 block">Sharpness</Label>
              <Slider
                value={[sharpness]}
                onValueChange={([value]) => setSharpness(value)}
                min={-100}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center mt-1">
                {sharpness > 0 ? `+${sharpness}` : sharpness} (Left: Blur, Right: Sharpen)
              </div>
            </div>

            {/* Reset Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="w-full"
            >
              Reset All
            </Button>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isProcessing || !croppedAreaPixels}>
            {isProcessing ? 'Processing...' : 'Save Image'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

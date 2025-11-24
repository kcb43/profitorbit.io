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
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [isProcessing, setIsProcessing] = useState(false);
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
  };

  const handleRotate = (direction) => {
    setRotation(prev => direction === 'cw' ? prev + 90 : prev - 90);
  };

  // Create edited image with filters and cropping
  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

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

  const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0, brightness = 100, contrast = 100) => {
    const image = await createImage(imageSrc);
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
    ctx.drawImage(image, 0, 0);

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
        contrast
      );

      if (croppedImage && onSave) {
        onSave(croppedImage);
        onOpenChange(false);
        handleReset(); // Reset for next use
      }
    } catch (error) {
      console.error('Error processing image:', error);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Crop Area */}
          <div className="relative flex-1 bg-black min-h-[400px]">
            <Cropper
              image={imageSrc}
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

          {/* Controls */}
          <div className="px-6 py-4 border-t space-y-4 overflow-y-auto max-h-[300px]">
            {/* Aspect Ratio */}
            <div>
              <Label className="text-sm mb-2 block">Aspect Ratio</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={aspect === 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAspect(1)}
                >
                  1:1
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
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Rotation</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRotate('ccw')}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRotate('cw')}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Slider
                value={[rotation]}
                onValueChange={([value]) => setRotation(value)}
                min={-180}
                max={180}
                step={1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center mt-1">{rotation}°</div>
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

        <DialogFooter className="px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isProcessing || !croppedAreaPixels}>
            {isProcessing ? 'Processing...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

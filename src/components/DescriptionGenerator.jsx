import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export function DescriptionGenerator({ 
  open, 
  onOpenChange, 
  onSelectDescription,
  title,
  brand,
  category,
  condition,
  similarDescriptions = [],
}) {
  const [descriptions, setDescriptions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateDescriptions = async () => {
    if (!title || title.trim().length === 0) {
      toast({
        title: "Title required",
        description: "Please enter a title before generating descriptions.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setCurrentIndex(0);

    try {
      const response = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          brand: brand || undefined,
          category: category || undefined,
          condition: condition || undefined,
          similarDescriptions: similarDescriptions.filter(Boolean),
          numVariations: 5, // Generate 5 variations
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.descriptions && data.descriptions.length > 0) {
        setDescriptions(data.descriptions);
        setCurrentIndex(0);
      } else {
        throw new Error('No descriptions generated');
      }
    } catch (error) {
      console.error('Error generating descriptions:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate descriptions. Please check your AI API configuration.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShuffle = () => {
    if (descriptions.length === 0) return;
    // Shuffle to a random description
    const randomIndex = Math.floor(Math.random() * descriptions.length);
    setCurrentIndex(randomIndex);
  };

  const handleNext = () => {
    if (descriptions.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % descriptions.length);
  };

  const handlePrevious = () => {
    if (descriptions.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + descriptions.length) % descriptions.length);
  };

  const handleSelect = () => {
    if (descriptions[currentIndex]) {
      onSelectDescription(descriptions[currentIndex]);
      onOpenChange(false);
      toast({
        title: "Description applied",
        description: "The selected description has been added to your form.",
      });
    }
  };

  const currentDescription = descriptions[currentIndex] || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Description Generator
          </DialogTitle>
          <DialogDescription>
            Generate multiple description variations based on similar items. Shuffle through options and select the best one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Generate button */}
          <div className="flex items-center justify-between">
            <Button
              onClick={generateDescriptions}
              disabled={isGenerating || !title || title.trim().length === 0}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Descriptions
                </>
              )}
            </Button>
            {descriptions.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {currentIndex + 1} of {descriptions.length}
              </span>
            )}
          </div>

          {/* Generated description display */}
          {descriptions.length > 0 && (
            <div className="space-y-4">
              <div className="relative">
                <Textarea
                  value={currentDescription}
                  readOnly
                  className="min-h-[150px] resize-none"
                />
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={descriptions.length <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShuffle}
                    disabled={descriptions.length <= 1}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Shuffle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={descriptions.length <= 1}
                  >
                    Next
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSelect}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Use This Description
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Info message when no descriptions yet */}
          {descriptions.length === 0 && !isGenerating && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click "Generate Descriptions" to create AI-powered description variations.</p>
              {similarDescriptions.length > 0 && (
                <p className="text-xs mt-2">
                  Found {similarDescriptions.length} similar item{similarDescriptions.length !== 1 ? 's' : ''} to use as reference.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


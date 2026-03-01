import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSizeInfo } from '@/utils/sizeDetection';

/**
 * Smart Size Field — conditionally renders an appropriate size picker
 * based on item title, description, and category.
 *
 * Hidden entirely for items that don't have sizes (electronics, books, etc.).
 * Shows type-appropriate size options for shoes, clothing, pants, etc.
 */
export function SmartSizeField({ title, description, category, value, onChange }) {
  const [customMode, setCustomMode] = useState(false);

  const info = useMemo(
    () => getSizeInfo(title || '', description || '', category || ''),
    [title, description, category]
  );

  if (!info.showSize) return null;

  const currentValue = value || '';

  // If the user already has a non-standard value, show it in custom mode
  const isCustomValue = currentValue && info.options?.type === 'single'
    && !info.options.values.includes(currentValue);

  const showCustom = customMode || isCustomValue;

  if (showCustom) {
    return (
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <Label className="text-foreground break-words">{info.label}</Label>
          <button
            type="button"
            onClick={() => setCustomMode(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Use presets
          </button>
        </div>
        <Input
          placeholder={info.placeholder}
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-foreground bg-background"
        />
      </div>
    );
  }

  // Dual select mode (bottoms: waist × inseam, intimates: band × cup)
  if (info.options?.type === 'dual') {
    return (
      <DualSizeSelect
        info={info}
        value={currentValue}
        onChange={onChange}
        onCustom={() => setCustomMode(true)}
      />
    );
  }

  // Single select mode (shoes, tops, dresses, etc.)
  return (
    <SingleSizeSelect
      info={info}
      value={currentValue}
      onChange={onChange}
      onCustom={() => setCustomMode(true)}
    />
  );
}

function SingleSizeSelect({ info, value, onChange, onCustom }) {
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between">
        <Label className="text-foreground break-words">{info.label}</Label>
        <button
          type="button"
          onClick={onCustom}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Custom size
        </button>
      </div>
      <Select
        value={value || undefined}
        onValueChange={(val) => onChange(val === '__clear__' ? '' : val)}
      >
        <SelectTrigger className="w-full text-foreground bg-background">
          <SelectValue placeholder={info.placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover text-popover-foreground max-h-64">
          <SelectItem value="__clear__" className="text-muted-foreground italic">
            Clear size
          </SelectItem>
          {info.options.values.map((size) => (
            <SelectItem key={size} value={size} className="text-foreground">
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DualSizeSelect({ info, value, onChange, onCustom }) {
  const isBottoms = !!info.options.waist;

  // Parse existing value like "32x30" or "34C"
  let firstVal = '';
  let secondVal = '';
  if (value) {
    if (isBottoms) {
      const parts = value.split(/[x×X]/);
      firstVal = parts[0]?.trim() || '';
      secondVal = parts[1]?.trim() || '';
    } else {
      // intimates: "34C" → band "34", cup "C"
      const match = value.match(/^(\d+)\s*([A-Za-z]+)$/);
      if (match) {
        firstVal = match[1];
        secondVal = match[2].toUpperCase();
      }
    }
  }

  // Check if current value is a letter size
  const letterSizes = info.options.letterSizes || [];
  const isLetterSize = letterSizes.includes(value);
  const [useLetterMode, setUseLetterMode] = useState(isLetterSize);

  const firstOptions = isBottoms ? info.options.waist : info.options.band;
  const secondOptions = isBottoms ? info.options.inseam : info.options.cup;
  const firstLabel = isBottoms ? 'Waist' : 'Band';
  const secondLabel = isBottoms ? 'Inseam' : 'Cup';

  const handleDualChange = (first, second) => {
    if (!first && !second) {
      onChange('');
    } else if (isBottoms) {
      onChange(first && second ? `${first}x${second}` : first || second);
    } else {
      onChange(first && second ? `${first}${second}` : first || second);
    }
  };

  if (useLetterMode) {
    return (
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <Label className="text-foreground break-words">{info.label}</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUseLetterMode(false)}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {isBottoms ? 'Waist × Inseam' : 'Band × Cup'}
            </button>
            <button
              type="button"
              onClick={onCustom}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Custom
            </button>
          </div>
        </div>
        <Select
          value={value || undefined}
          onValueChange={(val) => onChange(val === '__clear__' ? '' : val)}
        >
          <SelectTrigger className="w-full text-foreground bg-background">
            <SelectValue placeholder="Select size" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground">
            <SelectItem value="__clear__" className="text-muted-foreground italic">
              Clear size
            </SelectItem>
            {letterSizes.map((size) => (
              <SelectItem key={size} value={size} className="text-foreground">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between">
        <Label className="text-foreground break-words">{info.label}</Label>
        <div className="flex gap-2">
          {letterSizes.length > 0 && (
            <button
              type="button"
              onClick={() => { setUseLetterMode(true); onChange(''); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Letter sizes
            </button>
          )}
          <button
            type="button"
            onClick={onCustom}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Custom
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Select
            value={firstVal || undefined}
            onValueChange={(val) => {
              const v = val === '__clear__' ? '' : val;
              handleDualChange(v, secondVal);
            }}
          >
            <SelectTrigger className="w-full text-foreground bg-background">
              <SelectValue placeholder={firstLabel} />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground max-h-64">
              <SelectItem value="__clear__" className="text-muted-foreground italic">
                Clear
              </SelectItem>
              {firstOptions.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-foreground">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="flex items-center text-muted-foreground text-sm">×</span>
        <div className="flex-1">
          <Select
            value={secondVal || undefined}
            onValueChange={(val) => {
              const v = val === '__clear__' ? '' : val;
              handleDualChange(firstVal, v);
            }}
          >
            <SelectTrigger className="w-full text-foreground bg-background">
              <SelectValue placeholder={secondLabel} />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground max-h-64">
              <SelectItem value="__clear__" className="text-muted-foreground italic">
                Clear
              </SelectItem>
              {secondOptions.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-foreground">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

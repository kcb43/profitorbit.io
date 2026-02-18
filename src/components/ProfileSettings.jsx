import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { X, Check, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/api/supabaseClient';

/**
 * Preset DiceBear avatars for selection
 */
const PRESET_AVATARS = [
  { seed: 'Felix',  style: 'avataaars' },
  { seed: 'Aneka',  style: 'avataaars' },
  { seed: 'Willow', style: 'bottts' },
  { seed: 'Zoey',   style: 'bottts' },
  { seed: 'Leo',    style: 'notionists' },
  { seed: 'Mila',   style: 'notionists' },
  { seed: 'Oliver', style: 'lorelei' },
  { seed: 'Luna',   style: 'lorelei' },
];

function getDiceBearUrl(seed, style = 'avataaars') {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Profile Settings Dialog
 * Saves to Supabase auth user_metadata so there's one source of truth.
 */
export function ProfileSettings({ open, onOpenChange, user }) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('Felix');
  const [selectedStyle, setSelectedStyle] = useState('avataaars');
  const [avatarType, setAvatarType] = useState('dicebear');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load profile from Supabase user metadata when dialog opens
  useEffect(() => {
    if (open && user) {
      const meta = user.user_metadata || {};
      setDisplayName(meta.display_name || meta.full_name || meta.name || user.email?.split('@')[0] || '');
      setSelectedAvatar(meta.avatar_seed || 'Felix');
      setSelectedStyle(meta.avatar_style || 'avataaars');
      setAvatarType(meta.avatar_type || 'dicebear');
      setCustomImageUrl(meta.avatar_url || '');
      setHasChanges(false);
    }
  }, [open, user]);

  const handleAvatarSelect = (seed, style) => {
    setSelectedAvatar(seed);
    setSelectedStyle(style);
    setAvatarType('dicebear');
    setHasChanges(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image smaller than 5MB', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const userId = user?.id;
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${userId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setCustomImageUrl(data.publicUrl);
      setAvatarType('custom');
      setHasChanges(true);

      toast({ title: 'Image uploaded', description: 'Your custom avatar has been uploaded' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast({ title: 'Display name required', description: 'Please enter a display name', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          full_name: displayName.trim(),
          avatar_seed: selectedAvatar,
          avatar_style: selectedStyle,
          avatar_type: avatarType,
          avatar_url: avatarType === 'custom' ? customImageUrl : null,
        }
      });

      if (error) throw error;

      toast({ title: 'Profile saved', description: 'Your profile has been updated' });
      setHasChanges(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Profile Settings</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Display Name */}
          <div>
            <Label htmlFor="display-name" className="text-sm font-medium mb-2 block">
              Display Name
            </Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setHasChanges(true); }}
              placeholder="Enter your name"
              className="w-full"
            />
          </div>

          {/* Avatar Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Choose Avatar</Label>

            {/* Preset Avatars Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {PRESET_AVATARS.map(({ seed, style }) => {
                const isSelected = avatarType === 'dicebear' && selectedAvatar === seed;
                return (
                  <button
                    key={seed}
                    onClick={() => handleAvatarSelect(seed, style)}
                    className={cn(
                      "relative w-full aspect-square rounded-full bg-muted hover:bg-muted/80 transition-all",
                      isSelected && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    <img
                      src={getDiceBearUrl(seed, style)}
                      alt={seed}
                      className="w-full h-full object-cover rounded-full"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 rounded-full flex items-center justify-center">
                        <div className="bg-primary rounded-full p-1">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Image Upload */}
            <label
              htmlFor="avatar-upload"
              className={cn(
                "flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors hover:bg-muted/50",
                avatarType === 'custom' && "border-primary bg-primary/5"
              )}
            >
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              {avatarType === 'custom' && customImageUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={customImageUrl}
                    alt="Custom avatar"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="text-left">
                    <p className="text-sm font-medium">Custom Image Selected</p>
                    <p className="text-xs text-muted-foreground">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span className="text-xs">Upload custom image</span>
                </div>
              )}
            </label>
          </div>

          {/* Email (read-only) */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Email</Label>
            <Input value={user?.email || ''} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || !hasChanges}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Avatar display component — resolves the avatar URL from profile metadata.
 * Falls back to a DiceBear avatar if no custom image is set.
 */
export function UserAvatar({ profile, size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const seed  = profile?.avatar_seed  || profile?.user_metadata?.avatar_seed  || 'Felix';
  const style = profile?.avatar_style || profile?.user_metadata?.avatar_style || 'avataaars';
  const isCustom = (profile?.avatar_type || profile?.user_metadata?.avatar_type) === 'custom';
  const customUrl = profile?.avatar_url || profile?.user_metadata?.avatar_url;

  const avatarUrl = isCustom && customUrl ? customUrl : getDiceBearUrl(seed, style);
  const altText   = profile?.display_name || profile?.user_metadata?.display_name || 'User';

  return (
    <div className={cn("rounded-full overflow-hidden bg-muted flex-shrink-0", sizes[size])}>
      <img
        src={avatarUrl}
        alt={altText}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

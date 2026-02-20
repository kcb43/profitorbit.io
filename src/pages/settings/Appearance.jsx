import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Palette, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getSectionById } from '@/modules/settingsRegistry';
import SettingsSectionLayout from '@/components/settings/SettingsSectionLayout';

const section = getSectionById('appearance');

const THEMES = {
  'default-light': 'Light',
  'default-dark':  'Dark',
  'money-green-dark': 'Green',
};

function applyTheme(theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.className = theme.includes('dark') ? 'dark' : '';
}

export default function AppearanceSettings() {
  const { toast } = useToast();

  const [currentTheme, setCurrentTheme] = useState(
    () => localStorage.getItem('theme') || 'default-light',
  );
  const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(
    () => localStorage.getItem('skip_delete_confirmation') === 'true',
  );
  const [disableSmartRouting, setDisableSmartRouting] = useState(
    () => localStorage.getItem('orben_disable_smart_routing') === 'true',
  );

  function handleThemeChange(theme) {
    setCurrentTheme(theme);
    applyTheme(theme);
    toast({ title: 'Theme updated', description: `Switched to ${THEMES[theme]}` });
  }

  function handleSkipDelete(checked) {
    setSkipDeleteConfirmation(checked);
    localStorage.setItem('skip_delete_confirmation', checked.toString());
    toast({
      title: checked ? 'Delete confirmation disabled' : 'Delete confirmation enabled',
      description: checked
        ? 'You will only see one delete warning.'
        : 'You will see two delete warnings for safety.',
    });
  }

  function handleSmartRouting(checked) {
    setDisableSmartRouting(!checked);
    localStorage.setItem('orben_disable_smart_routing', (!checked).toString());
    toast({
      title: checked ? 'Smart routing enabled' : 'Smart routing disabled',
      description: checked
        ? 'Premium search (Oxylabs) used for high-value items.'
        : 'Only your explicitly-selected providers will be used.',
    });
  }

  return (
    <SettingsSectionLayout section={section}>
      {/* Theme */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred color theme</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="theme-select">App Theme</Label>
            <Select value={currentTheme} onValueChange={handleThemeChange}>
              <SelectTrigger id="theme-select" className="w-full sm:w-64">
                <SelectValue placeholder="Select a theme" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(THEMES).map(([key, name]) => (
                  <SelectItem key={key} value={key}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visual preview swatches */}
          <div className="mt-4 flex gap-3">
            {Object.entries(THEMES).map(([key, name]) => {
              const bg = key === 'default-light'
                ? 'bg-white border-2 border-gray-200'
                : key === 'default-dark'
                ? 'bg-gray-900 border-2 border-gray-700'
                : 'bg-gray-900 border-2 border-emerald-500';
              const label = key === 'default-light'
                ? 'text-gray-800'
                : 'text-white';
              const dot = key === 'money-green-dark' ? 'bg-emerald-500' : key === 'default-dark' ? 'bg-blue-400' : 'bg-blue-600';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleThemeChange(key)}
                  className={`flex flex-col items-center justify-center w-20 h-14 rounded-xl transition-all ${bg} ${currentTheme === key ? 'ring-2 ring-offset-2 ring-primary' : 'hover:opacity-80'}`}
                >
                  <div className={`w-3 h-3 rounded-full ${dot} mb-1`} />
                  <span className={`text-[10px] font-medium ${label}`}>{name}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* General preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>General Preferences</CardTitle>
              <CardDescription>Customize your experience</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="skip-delete-confirmation">Skip Delete Confirmation</Label>
              <p className="text-xs text-muted-foreground">
                Skip the second &ldquo;Are you sure?&rdquo; dialog when deleting items
              </p>
            </div>
            <Switch
              id="skip-delete-confirmation"
              checked={skipDeleteConfirmation}
              onCheckedChange={handleSkipDelete}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="smart-routing">Smart Search Routing</Label>
              <p className="text-xs text-muted-foreground">
                Automatically use premium search (Oxylabs) for high-value products
              </p>
            </div>
            <Switch
              id="smart-routing"
              checked={!disableSmartRouting}
              onCheckedChange={handleSmartRouting}
            />
          </div>
        </CardContent>
      </Card>
    </SettingsSectionLayout>
  );
}

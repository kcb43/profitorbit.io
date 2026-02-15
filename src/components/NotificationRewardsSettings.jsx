import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bell, Flame, Coins, AlertCircle, Clock } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";

export default function NotificationRewardsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Notification preferences
  const [prefs, setPrefs] = useState({
    in_app_enabled: true,
    push_enabled: true,
    email_enabled: false,
    returns_enabled: true,
    listing_nudges_enabled: true,
    deals_enabled: true,
    news_enabled: false,
    rewards_enabled: true,
    quiet_hours_enabled: false,
    quiet_start_local: '22:00',
    quiet_end_local: '08:00',
    timezone: 'America/New_York',
    deals_max_per_day: 10,
    listing_nudges_max_per_day: 3,
  });

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to manage settings');
        return;
      }

      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        setPrefs(data.data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updates) => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please log in to save settings');
        return;
      }

      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Settings saved');
        if (data.data) {
          setPrefs(data.data);
        }
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    await savePreferences({ [key]: value });
  };

  const handleRateLimit = async (key, value) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    // Debounce saving for slider changes
    setTimeout(() => savePreferences({ [key]: value }), 500);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Control how and when you receive notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Channel Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>In-App Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Show notifications in the notification center
                </p>
              </div>
              <Switch
                checked={prefs.in_app_enabled}
                onCheckedChange={(v) => handleToggle('in_app_enabled', v)}
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive push notifications on your device
                </p>
              </div>
              <Switch
                checked={prefs.push_enabled}
                onCheckedChange={(v) => handleToggle('push_enabled', v)}
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                checked={prefs.email_enabled}
                onCheckedChange={(v) => handleToggle('email_enabled', v)}
                disabled={saving}
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Topic Toggles */}
          <div className="space-y-1 mb-4">
            <Label className="text-base font-semibold">Notification Topics</Label>
            <p className="text-xs text-muted-foreground">Choose which types of notifications to receive</p>
          </div>

          <div className="space-y-4">
            {/* Rewards & Points - Benched for now */}
            {/* <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>Rewards & Points</Label>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Points earned, tier ups, Pulse Mode, credits
                </p>
              </div>
              <Switch
                checked={prefs.rewards_enabled}
                onCheckedChange={(v) => handleToggle('rewards_enabled', v)}
                disabled={saving}
              />
            </div>

            <Separator /> */}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Deal Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  New deals matching your interests (max {prefs.deals_max_per_day}/day)
                </p>
              </div>
              <Switch
                checked={prefs.deals_enabled}
                onCheckedChange={(v) => handleToggle('deals_enabled', v)}
                disabled={saving}
              />
            </div>

            {prefs.deals_enabled && (
              <div className="ml-4 space-y-2 p-3 bg-muted/30 rounded-md">
                <Label className="text-xs">Daily Deal Alert Limit</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[prefs.deals_max_per_day]}
                    onValueChange={([v]) => handleRateLimit('deals_max_per_day', v)}
                    min={1}
                    max={20}
                    step={1}
                    className="flex-1"
                    disabled={saving}
                  />
                  <span className="text-sm font-medium w-8">{prefs.deals_max_per_day}</span>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Listing Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Reminders to list items (max {prefs.listing_nudges_max_per_day}/day)
                </p>
              </div>
              <Switch
                checked={prefs.listing_nudges_enabled}
                onCheckedChange={(v) => handleToggle('listing_nudges_enabled', v)}
                disabled={saving}
              />
            </div>

            {prefs.listing_nudges_enabled && (
              <div className="ml-4 space-y-2 p-3 bg-muted/30 rounded-md">
                <Label className="text-xs">Daily Reminder Limit</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[prefs.listing_nudges_max_per_day]}
                    onValueChange={([v]) => handleRateLimit('listing_nudges_max_per_day', v)}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                    disabled={saving}
                  />
                  <span className="text-sm font-medium w-8">{prefs.listing_nudges_max_per_day}</span>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Return Deadlines</Label>
                <p className="text-xs text-muted-foreground">
                  Reminders for upcoming return deadlines
                </p>
              </div>
              <Switch
                checked={prefs.returns_enabled}
                onCheckedChange={(v) => handleToggle('returns_enabled', v)}
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>News & Updates</Label>
                <p className="text-xs text-muted-foreground">
                  Platform news and feature announcements
                </p>
              </div>
              <Switch
                checked={prefs.news_enabled}
                onCheckedChange={(v) => handleToggle('news_enabled', v)}
                disabled={saving}
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Quiet Hours */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <Label>Quiet Hours</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pause notifications during specific hours
                </p>
              </div>
              <Switch
                checked={prefs.quiet_hours_enabled}
                onCheckedChange={(v) => handleToggle('quiet_hours_enabled', v)}
                disabled={saving}
              />
            </div>

            {prefs.quiet_hours_enabled && (
              <div className="ml-4 space-y-3 p-3 bg-muted/30 rounded-md">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Start Time</Label>
                    <input
                      type="time"
                      value={prefs.quiet_start_local}
                      onChange={(e) => handleToggle('quiet_start_local', e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">End Time</Label>
                    <input
                      type="time"
                      value={prefs.quiet_end_local}
                      onChange={(e) => handleToggle('quiet_end_local', e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Timezone</Label>
                  <Select
                    value={prefs.timezone}
                    onValueChange={(v) => handleToggle('timezone', v)}
                    disabled={saving}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                      <SelectItem value="America/Phoenix">Arizona (MST)</SelectItem>
                      <SelectItem value="America/Anchorage">Alaska (AKT)</SelectItem>
                      <SelectItem value="Pacific/Honolulu">Hawaii (HST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rewards Info Card - Benched for now */}
      {/* <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Rewards System</CardTitle>
              <CardDescription>Learn how to earn and redeem points</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">+10</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Create Listing</p>
                <p className="text-xs text-muted-foreground">Earn 10 OP for each new listing</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">+25</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Sell Item</p>
                <p className="text-xs text-muted-foreground">Earn 25 OP + profit points per sale</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Pulse Mode</p>
                <p className="text-xs text-muted-foreground">Redeem 750 OP for 7 days of priority deal alerts</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
            <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Points are automatically awarded when you complete actions. Check your Rewards page to see your balance, tier, and available rewards!
            </p>
          </div>
        </CardContent>
      </Card> */}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { User, Mail, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { getSectionById } from '@/modules/settingsRegistry';
import SettingsSectionLayout from '@/components/settings/SettingsSectionLayout';

const section = getSectionById('account');

export default function AccountSettings() {
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) return;
      setSession(s);
      const meta = s.user?.user_metadata || {};
      setDisplayName(meta.display_name || meta.full_name || meta.name || '');
      setEmail(s.user?.email || '');
    });
  }, []);

  async function handleSaveName() {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (error) throw error;
      toast({ title: 'Name saved' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/Settings/security`,
      });
      if (error) throw error;
      toast({ title: 'Password reset email sent', description: `Check ${email}` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <SettingsSectionLayout section={section}>
      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" value={email} readOnly disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">
              Email changes require verification — contact support if needed.
            </p>
          </div>

          <Button onClick={handleSaveName} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Name
          </Button>
        </CardContent>
      </Card>

      {/* Account actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4" />
            Account Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reset Password</p>
              <p className="text-xs text-muted-foreground">
                Send a password reset link to {email || 'your email'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handlePasswordReset}>
              Send reset link
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign Out</p>
              <p className="text-xs text-muted-foreground">Sign out of this device</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                supabase.auth.signOut().then(() => (window.location.href = '/'))
              }
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </SettingsSectionLayout>
  );
}

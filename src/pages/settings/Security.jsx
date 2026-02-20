import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Monitor, Clock, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/api/supabaseClient';
import { getSectionById } from '@/modules/settingsRegistry';
import SettingsSectionLayout from '@/components/settings/SettingsSectionLayout';
import { format } from 'date-fns';

const section = getSectionById('security');

export default function SecuritySettings() {
  const { toast } = useToast();
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setEmail(s?.user?.email || '');
    });
  }, []);

  async function handlePasswordReset() {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/Settings/security`,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password reset email sent', description: `Check ${email}` });
    }
  }

  async function handleSignOutAll() {
    await supabase.auth.signOut({ scope: 'global' });
    window.location.href = '/';
  }

  const lastSignIn = session?.user?.last_sign_in_at
    ? format(new Date(session.user.last_sign_in_at), 'MMM d, yyyy h:mm a')
    : null;

  const provider = session?.user?.app_metadata?.provider ?? 'email';

  return (
    <SettingsSectionLayout section={section}>
      {/* Current session */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="w-4 h-4" />
            Current Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
            <Monitor className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">This device</p>
              {lastSignIn && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Last sign-in: {lastSignIn}
                </p>
              )}
            </div>
            <Badge variant="secondary" className="text-xs capitalize">
              {provider}
            </Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOutAll}
            className="text-destructive hover:text-destructive w-full"
          >
            Sign out all devices
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We&apos;ll send a secure reset link to <strong>{email}</strong>.
          </p>
          <Button variant="outline" onClick={handlePasswordReset} className="gap-2">
            <Mail className="w-4 h-4" />
            Send password reset email
          </Button>
        </CardContent>
      </Card>

      {/* 2FA coming soon */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            Two-Factor Authentication
            <Badge variant="secondary" className="text-xs ml-auto">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add an extra layer of security to your account with an authenticator app or SMS.
          </p>
        </CardContent>
      </Card>
    </SettingsSectionLayout>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/api/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { BarChart3, Lock, Eye, EyeOff, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // With PKCE flow, Supabase automatically exchanges the ?code= param from
    // the reset email and fires onAuthStateChange with PASSWORD_RECOVERY.
    // We must wait for that event before calling updateUser.

    // Check if there's already an active recovery session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
        setSessionError(null);
      } else if (event === 'SIGNED_IN' && session) {
        // Some Supabase versions fire SIGNED_IN instead of PASSWORD_RECOVERY
        setSessionReady(true);
        setSessionError(null);
      }
    });

    // If no session event fires within 8 seconds, the link has likely expired
    const timeout = setTimeout(() => {
      setSessionReady(prev => {
        if (!prev) setSessionError('This reset link has expired or is invalid. Please request a new one.');
        return prev;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    // Sign out so the user must log in once with their new password
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
    setTimeout(() => navigate('/login'), 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Orben</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Success state */}
          {done && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Updated!</h2>
              <p className="text-gray-500">Sign in once with your new password to continue.</p>
              <p className="text-sm text-gray-400 mt-2">Redirecting to login…</p>
            </div>
          )}

          {/* Link expired / invalid */}
          {!done && sessionError && (
            <div className="text-center py-4">
              <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h2>
              <p className="text-gray-500 text-sm mb-6">{sessionError}</p>
              <Button onClick={() => navigate('/login')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8">
                Back to Login
              </Button>
            </div>
          )}

          {/* Waiting for session */}
          {!done && !sessionError && !sessionReady && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-emerald-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">Verifying reset link…</p>
            </div>
          )}

          {/* Form — only shown when session is ready */}
          {!done && !sessionError && sessionReady && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Set a New Password</h2>
                <p className="text-gray-500 text-sm">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="Min. 6 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className="pl-10"
                      placeholder="Repeat your password"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                  disabled={loading}
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…</> : 'Update Password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Login Page
 * Dedicated login page with Gmail and GitHub authentication options
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/api/supabaseClient';
import { getPublicSiteOrigin } from '@/utils/publicSiteUrl';
import { useToast } from '@/components/ui/use-toast';
import { 
  Mail, 
  Github,
  ArrowLeft,
  BarChart3,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useEmailPassword, setUseEmailPassword] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getPublicSiteOrigin()}/dashboard`,
      },
    });
    if (error) {
      console.error('Sign in error:', error);
    }
  };

  const handleGithubSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${getPublicSiteOrigin()}/dashboard`,
      },
    });
    if (error) {
      console.error('Sign in error:', error);
      toast({
        title: 'Sign In Failed',
        description: error.message || 'Failed to sign in with GitHub',
        variant: 'destructive',
      });
    }
  };

  const handleEmailPasswordSignIn = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Validation Error',
        description: 'Please enter both email and password',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Sign In Failed',
          description: error.message || 'Invalid email or password',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Success - redirect handled by useEffect
      toast({
        title: 'Signed In',
        description: 'Welcome back!',
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: 'Sign In Failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Back Button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Orben
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-600">
              Sign in to your account to continue
            </p>
          </div>

          {!useEmailPassword ? (
            <div className="space-y-4">
              {/* Email/Password Login Option */}
              <Button
                onClick={() => setUseEmailPassword(true)}
                className="w-full h-12 text-base bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all duration-200"
                size="lg"
              >
                <Mail className="w-5 h-5 mr-3" />
                Sign in with Email
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In */}
              <Button
                onClick={handleGoogleSignIn}
                className="w-full h-12 text-base bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm transition-all duration-200"
                size="lg"
              >
                <Mail className="w-5 h-5 mr-3" />
                Continue with Gmail
              </Button>

              {/* GitHub Sign In */}
              <Button
                onClick={handleGithubSignIn}
                className="w-full h-12 text-base bg-gray-900 text-white hover:bg-gray-800 shadow-md transition-all duration-200"
                size="lg"
              >
                <Github className="w-5 h-5 mr-3" />
                Continue with GitHub
              </Button>
            </div>
          ) : (
            <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-700">
                  Email
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-gray-700">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10"
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setUseEmailPassword(false)}
                  className="text-sm text-emerald-600 hover:text-emerald-700"
                >
                  ← Back to other options
                </button>
                <Link to="/signup" className="text-sm text-emerald-600 hover:text-emerald-700">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg"
                size="lg"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-center text-gray-500">
              By signing in, you agree to our{' '}
              <a href="/PrivacyPolicy" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


/**
 * Landing/Cover Page - Obsidian-inspired design
 * Main entry point for unauthenticated users
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/api/supabaseClient';
import { getPublicSiteOrigin } from '@/utils/publicSiteUrl';
import { 
  BarChart3,
  ArrowRight,
  Menu,
  X,
  Package,
  Rocket,
  TrendingUp,
  Lock,
  Zap,
  Layers,
  Sparkles,
  CheckCircle2,
  Shield,
  Link as LinkIcon,
  Network,
  Palette,
  MessageCircle,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);

  // If user is already signed in, skip the marketing landing and go straight to dashboard.
  React.useEffect(() => {
    let cancelled = false;
    let subscription = null;

    const goDashboard = () => navigate('/dashboard', { replace: true });

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          goDashboard();
          return;
        }

        for (let i = 0; i < 4; i++) {
          await new Promise((r) => setTimeout(r, 200));
          const { data: { session: retry } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (retry) {
            goDashboard();
            return;
          }
        }
      } catch {
        // ignore; just show landing
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) goDashboard();
    });
    subscription = data?.subscription || null;

    check();

    return () => {
      cancelled = true;
      if (subscription) subscription.unsubscribe();
    };
  }, [navigate]);

  // Handle OAuth callback
  React.useEffect(() => {
    const handleOAuthCallback = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session) {
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/dashboard', { replace: true });
          } else if (error) {
            console.error('❌ OAuth callback error:', error);
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              window.history.replaceState(null, '', window.location.pathname);
              navigate('/dashboard', { replace: true });
            }
          }
        } catch (error) {
          console.error('❌ Error processing OAuth callback:', error);
        }
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  const handleGetStarted = () => {
    navigate('/signup');
  };

  const handleSignIn = async () => {
    // Diagnostic logging
    console.log('🔐 Starting OAuth...');
    console.log('🌍 Public Site Origin:', getPublicSiteOrigin());
    console.log('📍 Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('🔑 Anon Key (first 20 chars):', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20));
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getPublicSiteOrigin()}/dashboard`,
      },
    });
    
    console.log('📦 OAuth Response:', data);
    console.log('❌ OAuth Error:', error);
    
    if (data?.url) {
      console.log('🔗 Full OAuth URL:', data.url);
      // Extract the redirect_uri from the OAuth URL
      try {
        const url = new URL(data.url);
        const redirectUri = url.searchParams.get('redirect_uri');
        console.log('🎯 Redirect URI being sent to Google:', redirectUri);
        console.log('');
        console.log('⚠️ IMPORTANT: Copy the redirect URI above and verify it matches EXACTLY in:');
        console.log('   Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs');
      } catch (e) {
        console.error('Failed to parse OAuth URL:', e);
      }
    }
    
    if (error) {
      console.error('Sign in error:', error);
    }
  };

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header - Obsidian style */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200/50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">Profit Orbit</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => scrollToSection('features')} 
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Pricing
              </button>
              <button 
                onClick={() => scrollToSection('community')} 
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Community
              </button>
              <Button onClick={handleSignIn} variant="ghost" size="sm" className="text-gray-700">
                Sign In
              </Button>
              <Button onClick={handleGetStarted} size="sm" className="bg-gray-900 hover:bg-gray-800 text-white">
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2 border-t border-gray-200">
              <button 
                onClick={() => scrollToSection('features')} 
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Pricing
              </button>
              <button 
                onClick={() => scrollToSection('community')} 
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                Community
              </button>
              <div className="flex gap-2 pt-2 border-t border-gray-200 px-4">
                <Button onClick={handleSignIn} variant="outline" size="sm" className="flex-1">
                  Sign In
                </Button>
                <Button onClick={handleGetStarted} size="sm" className="flex-1 bg-gray-900 hover:bg-gray-800 text-white">
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section - Obsidian style */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gray-900 leading-tight">
            Grow your resale business
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            The free and flexible platform for managing inventory, tracking sales, and automating crosslisting across marketplaces.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleGetStarted} 
              size="lg" 
              className="text-lg px-8 py-6 bg-gray-900 hover:bg-gray-800 text-white shadow-lg"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              onClick={() => scrollToSection('features')} 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6 border-gray-300 hover:bg-gray-50"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Three Key Value Props - Obsidian style */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {/* Your data is yours */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-6">
                <Lock className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Your data is yours</h3>
              <p className="text-gray-600 leading-relaxed">
                Your inventory, sales, and business information stays private and secure. We never sell your data.
              </p>
            </div>

            {/* Your workflow is unique */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
                <Palette className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Your workflow is unique</h3>
              <p className="text-gray-600 leading-relaxed">
                Customize your dashboard, organize inventory your way, and automate listings across the marketplaces you choose.
              </p>
            </div>

            {/* Your business should grow */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Your business should grow</h3>
              <p className="text-gray-600 leading-relaxed">
                Track profits, analyze trends, and make data-driven decisions to scale your resale business efficiently.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Sections - Obsidian style */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
            {/* Left: Visual placeholder */}
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-12 aspect-square flex items-center justify-center">
                <div className="text-center">
                  <Layers className="w-24 h-24 text-emerald-600 mx-auto mb-4" />
                  <div className="text-sm text-gray-600">Crosslisting Visualization</div>
                </div>
              </div>
            </div>
            {/* Right: Content */}
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Crosslist everywhere
              </h2>
              <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                List your items on multiple marketplaces with a single click. Connect to eBay, Mercari, Facebook Marketplace, Etsy, and Poshmark—all from one place.
              </p>
              <a href="#features" className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-2">
                Learn more
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
            {/* Left: Content */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Track your progress
              </h2>
              <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                Visualize your sales performance, profit trends, and growth patterns with comprehensive analytics. Know exactly how your business is performing.
              </p>
              <a href="#features" className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-2">
                Learn more
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            {/* Right: Visual placeholder */}
            <div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-12 aspect-square flex items-center justify-center">
                <div className="text-center">
                  <Network className="w-24 h-24 text-blue-600 mx-auto mb-4" />
                  <div className="text-sm text-gray-600">Analytics Dashboard</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Visual placeholder */}
            <div className="order-2 lg:order-1">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-12 aspect-square flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-24 h-24 text-purple-600 mx-auto mb-4" />
                  <div className="text-sm text-gray-600">Pro Tools</div>
                </div>
              </div>
            </div>
            {/* Right: Content */}
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Automate your workflow
              </h2>
              <p className="text-xl text-gray-600 mb-6 leading-relaxed">
                Send bulk offers, create auto-offer rules, and automate marketplace sharing. Build your ideal reselling workflow with powerful automation tools.
              </p>
              <a href="#features" className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-2">
                Learn more
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Sync Section - Obsidian style */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Sync across devices.
          </h2>
          <p className="text-xl text-gray-600 mb-6 leading-relaxed">
            Access your inventory, sales, and analytics on any device. Your data syncs securely and stays up to date everywhere you work.
          </p>
          <a href="#features" className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-2">
            Learn more.
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Pricing Section - Obsidian style */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start free. Upgrade when you're ready to scale.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Up to 100 items</span>
                </li>
                <li className="flex items-start text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Basic analytics</span>
                </li>
                <li className="flex items-start text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Manual crosslisting</span>
                </li>
              </ul>
              <Button onClick={handleGetStarted} className="w-full" variant="outline">
                Get Started
              </Button>
            </div>
            <div className="bg-gray-900 rounded-xl p-8 border-2 border-gray-900 text-white">
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$9.99</span>
                <span className="text-gray-400">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Unlimited items</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Automated crosslisting</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Pro Tools (offers, sharing)</span>
                </li>
              </ul>
              <Button onClick={handleGetStarted} className="w-full bg-white text-gray-900 hover:bg-gray-100">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Community Section - Obsidian style */}
      <section id="community" className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Connect with resellers.
          </h2>
          <p className="text-xl text-gray-600 mb-6 leading-relaxed">
            Join a community of resellers sharing tips, strategies, and success stories. Learn from others and grow your business together.
          </p>
          <a href="#features" className="text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-2">
            Learn more.
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* CTA Section - Obsidian style */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            It's your time to grow.
          </h2>
          <Button 
            onClick={handleGetStarted} 
            size="lg" 
            className="text-lg px-8 py-6 bg-white text-gray-900 hover:bg-gray-100"
          >
            Get Started Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer - Obsidian style */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Get started</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><button onClick={handleGetStarted} className="hover:text-gray-900">Sign Up</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-gray-900">Pricing</button></li>
                <li><a href="/FAQ" className="hover:text-gray-900">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-gray-900">Features</button></li>
                <li><button onClick={() => scrollToSection('community')} className="hover:text-gray-900">Community</button></li>
                <li><a href="/FAQ" className="hover:text-gray-900">Help</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/PrivacyPolicy" className="hover:text-gray-900">Privacy</a></li>
                <li><a href="/PrivacyPolicy" className="hover:text-gray-900">Security</a></li>
                <li><a href="/FAQ" className="hover:text-gray-900">About</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><button onClick={() => scrollToSection('community')} className="hover:text-gray-900">Join Community</button></li>
                <li><a href="/FAQ" className="hover:text-gray-900">Discord</a></li>
                <li><a href="/FAQ" className="hover:text-gray-900">Forum</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-green-600 rounded flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900">Profit Orbit</span>
            </div>
            <p className="text-sm text-gray-600">© {new Date().getFullYear()} Profit Orbit. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

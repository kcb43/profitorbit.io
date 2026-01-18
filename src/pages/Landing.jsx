/**
 * Landing/Cover Page
 * Main entry point for unauthenticated users
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/api/supabaseClient';
import { getPublicSiteOrigin } from '@/utils/publicSiteUrl';
import { 
  Rocket, 
  Zap, 
  Shield, 
  BarChart3, 
  Users, 
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  TrendingUp,
  Package,
  Sparkles
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);

  // If user is already signed in, skip the marketing landing and go straight to dashboard.
  // Important: Supabase session hydration can be async on cold loads; we briefly wait/subscribe
  // so users don't get "sent to the cover page" while already signed in.
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

        // Session can appear shortly after hydration; retry a couple times quickly.
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

    // Also subscribe: if something refreshes/sets session, jump immediately.
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

  // Handle OAuth callback - check for hash fragment with access_token
  React.useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if we have OAuth callback hash fragment
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('🔐 OAuth callback detected, processing...');
        
        // Wait for Supabase to process the hash fragment
        // Supabase automatically processes hash fragments on initialization
        // But we need to wait a bit for it to complete
        try {
          // Check session after a short delay to allow Supabase to process
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (session) {
            console.log('✅ OAuth callback successful, session established');
            // Clear the hash fragment and redirect to dashboard
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/dashboard', { replace: true });
          } else if (error) {
            console.error('❌ OAuth callback error:', error);
          } else {
            console.warn('⚠️ OAuth callback detected but no session found');
            // Retry once more after a longer delay
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

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-200/50 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Orben
              </h1>
            </div>
            
            {/* Centered Navigation Buttons */}
            <div className="hidden md:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
              <Button 
                onClick={() => scrollToSection('features')} 
                variant="ghost" 
                size="sm"
                className="text-sm font-medium text-gray-700 hover:text-emerald-600 hover:bg-emerald-50"
              >
                Features
              </Button>
              <Button 
                onClick={() => scrollToSection('pricing')} 
                variant="ghost" 
                size="sm"
                className="text-sm font-medium text-gray-700 hover:text-emerald-600 hover:bg-emerald-50"
              >
                Plans
              </Button>
              <Button 
                onClick={() => scrollToSection('services')} 
                variant="ghost" 
                size="sm"
                className="text-sm font-medium text-gray-700 hover:text-emerald-600 hover:bg-emerald-50"
              >
                Services
              </Button>
              <Button 
                onClick={() => scrollToSection('contact')} 
                variant="ghost" 
                size="sm"
                className="text-sm font-medium text-gray-700 hover:text-emerald-600 hover:bg-emerald-50"
              >
                Contact
              </Button>
            </div>

            {/* Right Side Actions */}
            <div className="hidden md:flex items-center gap-3">
              <Button onClick={handleSignIn} variant="ghost" size="sm" className="text-gray-700 hover:text-emerald-600">
                Sign In
              </Button>
              <Button onClick={handleGetStarted} size="sm" className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md">
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
              <Button 
                onClick={() => scrollToSection('features')} 
                variant="ghost" 
                className="w-full justify-start text-gray-700"
              >
                Features
              </Button>
              <Button 
                onClick={() => scrollToSection('pricing')} 
                variant="ghost" 
                className="w-full justify-start text-gray-700"
              >
                Plans
              </Button>
              <Button 
                onClick={() => scrollToSection('services')} 
                variant="ghost" 
                className="w-full justify-start text-gray-700"
              >
                Services
              </Button>
              <Button 
                onClick={() => scrollToSection('contact')} 
                variant="ghost" 
                className="w-full justify-start text-gray-700"
              >
                Contact
              </Button>
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <Button onClick={handleSignIn} variant="outline" size="sm" className="flex-1">
                  Sign In
                </Button>
                <Button onClick={handleGetStarted} size="sm" className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white">
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100/80 backdrop-blur-sm border border-emerald-200/50 mb-8">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">The all-in-one resale platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-emerald-700 bg-clip-text text-transparent">
              Streamline Your
            </span>
            <br />
            <span className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 bg-clip-text text-transparent">
              Resale Business
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Manage inventory, track sales, and automate crosslisting across multiple marketplaces. 
            <span className="font-semibold text-gray-800"> Everything you need to grow your resale business in one place.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              onClick={handleGetStarted} 
              size="lg" 
              className="text-lg px-8 py-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              onClick={handleSignIn} 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6 border-2 border-gray-300 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-300"
            >
              Sign In
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8 border-t border-gray-200">
            <div>
              <div className="text-3xl font-bold text-gray-900">100+</div>
              <div className="text-sm text-gray-600 mt-1">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">10K+</div>
              <div className="text-sm text-gray-600 mt-1">Items Listed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">$500K+</div>
              <div className="text-sm text-gray-600 mt-1">Sales Tracked</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Powerful Features for <span className="text-emerald-600">Resellers</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to scale your resale business efficiently
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-emerald-200">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Package className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Inventory Management</h3>
                <p className="text-gray-600 leading-relaxed">
                  Track all your items, manage stock levels, and organize your inventory with ease. Never lose track of what you have.
                </p>
              </div>
            </div>
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-emerald-200">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Rocket className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Automated Crosslisting</h3>
                <p className="text-gray-600 leading-relaxed">
                  List your items on multiple marketplaces automatically. Save hours of manual work and reach more buyers instantly.
                </p>
              </div>
            </div>
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-emerald-200">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Sales Analytics</h3>
                <p className="text-gray-600 leading-relaxed">
                  Get deep insights into your sales performance, profit margins, and growth trends. Make data-driven decisions.
                </p>
              </div>
            </div>
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-emerald-200">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & Reliable</h3>
                <p className="text-gray-600 leading-relaxed">
                  Your data is encrypted and secure. We take privacy seriously and ensure your business information stays protected.
                </p>
              </div>
            </div>
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-emerald-200">
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Built for Resellers</h3>
                <p className="text-gray-600 leading-relaxed">
                  Designed specifically for resellers, by resellers. Everything you need, nothing you don't. Focus on what matters.
                </p>
              </div>
            </div>
            <div className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 hover:border-emerald-200">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Easy to Use</h3>
                <p className="text-gray-600 leading-relaxed">
                  Intuitive interface that makes managing your business simple and enjoyable. Get started in minutes, not hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Simple, <span className="text-emerald-600">Transparent</span> Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your business needs
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">Free</span>
              </div>
              <ul className="space-y-4 mb-8">
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
              <Button onClick={handleGetStarted} className="w-full" variant="outline" size="lg">
                Get Started
              </Button>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-2xl p-8 border-4 border-emerald-400 relative transform scale-105 hover:scale-110 transition-transform duration-300">
              <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-4 py-1 rounded-bl-lg rounded-tr-2xl">
                POPULAR
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 mt-4">Pro</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold text-white">$29</span>
                <span className="text-lg text-emerald-100 ml-2">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start text-white">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Unlimited items</span>
                </li>
                <li className="flex items-start text-white">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-start text-white">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Automated crosslisting</span>
                </li>
                <li className="flex items-start text-white">
                  <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                  <span>Priority support</span>
                </li>
              </ul>
              <Button onClick={handleGetStarted} className="w-full bg-white text-emerald-600 hover:bg-gray-100" size="lg">
                Get Started
              </Button>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-start text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Custom integrations</span>
                </li>
                <li className="flex items-start text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span>Dedicated support</span>
                </li>
              </ul>
              <Button onClick={handleGetStarted} className="w-full" variant="outline" size="lg">
                Contact Us
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative py-24 bg-gradient-to-b from-white via-emerald-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need to <span className="text-emerald-600">Succeed</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive tools designed to help your resale business thrive
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-emerald-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Inventory Management</h3>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Keep track of all your items with detailed information, photos, and pricing. 
                Organize by category, tags, or custom labels. Never lose track of what you have in stock.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-blue-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Crosslisting Automation</h3>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Automatically list your items on multiple marketplaces including Mercari, Facebook Marketplace, 
                and more. Save hours of manual work and reach more buyers instantly.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-purple-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Sales Tracking</h3>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Monitor your sales performance, track profits, and analyze trends to make better business decisions. 
                Know exactly where your money is coming from.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-indigo-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Analytics & Reports</h3>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Get detailed insights into your business with comprehensive reports and visualizations. 
                Understand your growth patterns and optimize your strategy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative py-24 bg-gradient-to-br from-emerald-600 via-green-600 to-emerald-700">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-emerald-50 mb-10 max-w-2xl mx-auto">
            Join hundreds of resellers who are already streamlining their business with Orben. 
            Start your free account today and see the difference.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleGetStarted} 
              size="lg" 
              className="text-lg px-8 py-6 bg-white text-emerald-600 hover:bg-gray-100 shadow-xl"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              onClick={() => window.location.href = 'mailto:support@orben.com'} 
              size="lg" 
              className="text-lg px-8 py-6 border-2 border-white text-white bg-transparent hover:bg-white/20 hover:text-white shadow-lg"
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Orben</h3>
              </div>
              <p className="text-sm">Streamline your resale business with powerful tools and analytics.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</a></li>
                <li><a href="#services" className="hover:text-emerald-400 transition-colors">Services</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#contact" className="hover:text-emerald-400 transition-colors">Contact</a></li>
                <li><a href="/FAQ" className="hover:text-emerald-400 transition-colors">FAQ</a></li>
                <li><a href="/PrivacyPolicy" className="hover:text-emerald-400 transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Get Started</h4>
              <Button onClick={handleGetStarted} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Sign Up Free
              </Button>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} Orben. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}



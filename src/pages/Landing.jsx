/**
 * Landing/Cover Page - StalkFun-inspired dark theme design
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
  Moon,
  Sun,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(true); // Default to dark theme like StalkFun

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

  const handleSignIn = () => {
    // Navigate to the login page where users can choose their sign-in method
    navigate('/login');
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
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#0a0a0a] text-white' : 'bg-white text-gray-900'}`}>
      {/* Navigation Header - StalkFun style */}
      <header className={`sticky top-0 z-50 ${darkMode ? 'bg-[#0a0a0a]/95' : 'bg-white/95'} backdrop-blur-sm border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Profit Orbit
              </span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => scrollToSection('features')} 
                className={`text-sm font-medium ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')} 
                className={`text-sm font-medium ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
              >
                How It Works
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className={`text-sm font-medium ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
              >
                Pricing
              </button>
              
              {/* Theme Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
                aria-label="Toggle theme"
              >
                {darkMode ? <Sun className="w-5 h-5 text-gray-300" /> : <Moon className="w-5 h-5 text-gray-600" />}
              </button>

              <Button 
                onClick={handleSignIn} 
                variant="ghost" 
                size="sm" 
                className={darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700'}
              >
                Sign In
              </Button>
              <Button 
                onClick={handleGetStarted} 
                size="sm" 
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 rounded-full"
              >
                Login
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
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
            <div className={`md:hidden py-4 space-y-2 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <button 
                onClick={() => scrollToSection('features')} 
                className={`block w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'} rounded-lg`}
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')} 
                className={`block w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'} rounded-lg`}
              >
                How It Works
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className={`block w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'} rounded-lg`}
              >
                Pricing
              </button>
              <div className={`flex gap-2 pt-2 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} px-4`}>
                <Button onClick={handleSignIn} variant="outline" size="sm" className="flex-1">
                  Sign In
                </Button>
                <Button 
                  onClick={handleGetStarted} 
                  size="sm" 
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full"
                >
                  Login
                </Button>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section - StalkFun style */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="text-center">
          <h1 className={`text-5xl md:text-7xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'} leading-tight`}>
            Discover Your Next
            <br />
            <span className="text-emerald-500">Big Sale</span> Before Others
          </h1>
          <p className={`text-xl md:text-2xl ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-10 max-w-3xl mx-auto leading-relaxed`}>
            Your reselling command center. Everything you need. Nothing you don't. All for One.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleGetStarted} 
              size="lg" 
              className="text-lg px-8 py-6 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-full shadow-lg shadow-emerald-500/30"
            >
              Login
            </Button>
          </div>
        </div>

        {/* Dashboard Preview Mockup - Similar to StalkFun's token cards */}
        <div className="mt-16 relative">
          <div className={`rounded-2xl overflow-hidden border ${darkMode ? 'bg-[#111111] border-gray-800' : 'bg-gray-50 border-gray-200'} p-6 shadow-2xl`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sample Inventory Card */}
              <div className={`rounded-xl ${darkMode ? 'bg-[#1a1a1a] border border-gray-800' : 'bg-white border border-gray-200'} p-5 hover:scale-105 transition-transform`}>
                <div className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'} mb-3`}>
                  Inventory
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Nike Sneakers</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>In Stock</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cost</span>
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$45</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Listed</span>
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$89</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Profit</span>
                    <span className="font-semibold text-emerald-500">+$44</span>
                  </div>
                </div>
              </div>

              {/* Sample Sales Card */}
              <div className={`rounded-xl ${darkMode ? 'bg-[#1a1a1a] border border-gray-800' : 'bg-white border border-gray-200'} p-5 hover:scale-105 transition-transform`}>
                <div className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'} mb-3`}>
                  Sourcing
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Vintage Watch</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Sold Today</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sale Price</span>
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$250</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cost</span>
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$120</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Net Profit</span>
                    <span className="font-semibold text-emerald-500">+$130</span>
                  </div>
                </div>
              </div>

              {/* Sample Analytics Card */}
              <div className={`rounded-xl ${darkMode ? 'bg-[#1a1a1a] border border-gray-800' : 'bg-white border border-gray-200'} p-5 hover:scale-105 transition-transform`}>
                <div className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-500' : 'text-gray-400'} mb-3`}>
                  Management
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>This Month</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Performance</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sales</span>
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>47</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</span>
                    <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$3,240</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Profit</span>
                    <span className="font-semibold text-emerald-500">+$1,890</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section - StalkFun style */}
      <section className={`py-20 ${darkMode ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-4xl md:text-5xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
              Loved by Resellers
            </h2>
            <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Real stories from real sellers who are growing their businesses with Profit Orbit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Sarah M.", badge: "Pro User", quote: "Profit Orbit has completely transformed how I manage my reselling business. The crosslisting feature alone saves me hours every week!" },
              { name: "Mike R.", badge: "Pro User", quote: "I've tried other tools, but nothing compares to the analytics and insights I get from Profit Orbit. My profits have increased by 40% since I started using it." },
              { name: "Jessica L.", badge: "Pro User", quote: "The inventory management is seamless, and the ability to track everything in one place has been a game changer for my business." }
            ].map((testimonial, index) => (
              <div key={index} className={`rounded-xl ${darkMode ? 'bg-[#111111] border border-gray-800' : 'bg-gray-50 border border-gray-200'} p-6`}>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-4 italic`}>
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {testimonial.name}
                    </h4>
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {testimonial.badge}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section - StalkFun style */}
      <section id="how-it-works" className={`py-20 ${darkMode ? 'bg-[#111111]' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className={`text-4xl md:text-5xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
              How Profit Orbit Works
            </h2>
            <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'} max-w-3xl mx-auto`}>
              Our platform combines inventory management, analytics, and automation to help you make smart reselling decisions and grow your business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-6">
                <Zap className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-3`}>
                Real-time Notifications
              </h3>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                Get instant alerts on sales, price changes, and inventory updates so you never miss an opportunity.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-6">
                <Network className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-3`}>
                Crosslist Automation
              </h3>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                List your items across multiple marketplaces with a single click. eBay, Mercari, Facebook—all in one place.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 mb-6">
                <BarChart3 className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-3`}>
                Real-time Analytics
              </h3>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                Track performance, profits, and trends with comprehensive dashboards and reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section - StalkFun style */}
      <section id="features" className={`py-20 ${darkMode ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className={`text-4xl md:text-5xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
              Key Features of Profit Orbit
            </h2>
            <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'} max-w-3xl mx-auto`}>
              Explore the powerful tools Profit Orbit offers to give you an edge in the reselling market.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Feature 1 */}
            <div className={`rounded-2xl ${darkMode ? 'bg-[#111111] border border-gray-800' : 'bg-gray-50 border border-gray-200'} p-8 hover:scale-105 transition-transform`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Layers className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Crosslist Manager
                </h3>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                Real-time crosslisting platform connecting to eBay, Mercari, Facebook Marketplace, and more. List once, sell everywhere.
              </p>
            </div>

            {/* Feature 2 */}
            <div className={`rounded-2xl ${darkMode ? 'bg-[#111111] border border-gray-800' : 'bg-gray-50 border border-gray-200'} p-8 hover:scale-105 transition-transform`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Package className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Inventory Tracker
                </h3>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                Comprehensive tracking of your entire inventory with real-time updates, cost tracking, and profit calculations.
              </p>
            </div>

            {/* Feature 3 */}
            <div className={`rounded-2xl ${darkMode ? 'bg-[#111111] border border-gray-800' : 'bg-gray-50 border border-gray-200'} p-8 hover:scale-105 transition-transform`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Profit Analytics
                </h3>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                Your personal profit tracking command center. Monitor sales, track profits, analyze trends, and make data-driven decisions.
              </p>
            </div>

            {/* Feature 4 */}
            <div className={`rounded-2xl ${darkMode ? 'bg-[#111111] border border-gray-800' : 'bg-gray-50 border border-gray-200'} p-8 hover:scale-105 transition-transform`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Pro Tools
                </h3>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                Advanced automation tools for bulk operations, auto-offers, and marketplace sharing to maximize your efficiency.
              </p>
            </div>
          </div>

          {/* Security & AI Section */}
          <div className={`rounded-2xl ${darkMode ? 'bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border border-emerald-800/30' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200'} p-12 text-center`}>
            <h2 className={`text-3xl md:text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
              Secure & Smart Reselling
            </h2>
            <p className={`text-xl ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-8 max-w-3xl mx-auto`}>
              Profit Orbit combines intelligent analytics with advanced security to protect your business and maximize your growth potential.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-1" />
                <div className="text-left">
                  <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                    Data Protection
                  </h4>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                    Your business data is encrypted and secure. We never sell your information.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Sparkles className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-1" />
                <div className="text-left">
                  <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>
                    AI-Powered Insights
                  </h4>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                    Leverage intelligent analytics to identify trends and optimize your pricing strategy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - StalkFun style */}
      <section id="pricing" className={`py-20 ${darkMode ? 'bg-[#111111]' : 'bg-gray-50'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-4xl md:text-5xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>
              Become a Pro
            </h2>
            <p className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              One successful sale can pay for a month's subscription. Unlock every feature and get the ultimate edge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Plan */}
            <div className={`rounded-2xl ${darkMode ? 'bg-[#0a0a0a] border border-gray-800' : 'bg-white border border-gray-200'} p-8`}>
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Free</h3>
              <div className="mb-6">
                <span className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$0</span>
                <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>/month</span>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
                For getting started with basic features.
              </p>
              <ul className="space-y-3 mb-8">
                {['Up to 100 items', 'Basic analytics', 'Manual crosslisting', 'Single marketplace'].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={handleGetStarted} 
                className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'} rounded-full`}
              >
                Get Started
              </Button>
            </div>

            {/* Pro Monthly Plan - Featured */}
            <div className={`rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-8 relative transform scale-105 shadow-2xl`}>
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white">
                POPULAR
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Pro Monthly</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">$9.99</span>
                <span className="text-emerald-100">/month</span>
              </div>
              <p className="text-emerald-100 mb-6">
                For elite resellers who want the ultimate edge.
              </p>
              <ul className="space-y-3 mb-8">
                {['Unlimited items', 'Advanced analytics', 'Automated crosslisting', 'All marketplaces', 'Pro Tools', 'Priority support'].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-white mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-white">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={handleGetStarted} 
                className="w-full bg-white text-emerald-600 hover:bg-emerald-50 rounded-full font-bold"
              >
                Get Started
              </Button>
            </div>

            {/* Pro Yearly Plan */}
            <div className={`rounded-2xl ${darkMode ? 'bg-[#0a0a0a] border border-gray-800' : 'bg-white border border-gray-200'} p-8`}>
              <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Pro Yearly</h3>
              <div className="mb-6">
                <span className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>$99</span>
                <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>/year</span>
                <div className="text-sm text-emerald-500 font-semibold mt-1">Save 17%</div>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
                For elite resellers who want the ultimate edge.
              </p>
              <ul className="space-y-3 mb-8">
                {['Unlimited items', 'Advanced analytics', 'Automated crosslisting', 'All marketplaces', 'Pro Tools', 'Priority support', 'Price lock 12 months'].map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                onClick={handleGetStarted} 
                className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'} rounded-full`}
              >
                Get Started
              </Button>
            </div>
          </div>

          <p className={`text-center text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'} mt-8`}>
            All sales final. Cancel anytime.
          </p>
        </div>
      </section>

      {/* More Testimonials */}
      <section className={`py-20 ${darkMode ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "David T.", badge: "Pro User", quote: "Best reselling tool I've ever used. The crosslisting feature saves me so much time and the analytics help me price my items perfectly." },
              { name: "Emily K.", badge: "Pro User", quote: "I was skeptical at first, but Profit Orbit has completely changed how I run my reselling business. Worth every penny!" },
              { name: "James P.", badge: "Pro User", quote: "The profit tracking is incredible. I can see exactly which items are making me money and adjust my strategy accordingly." }
            ].map((testimonial, index) => (
              <div key={index} className={`rounded-xl ${darkMode ? 'bg-[#111111] border border-gray-800' : 'bg-gray-50 border border-gray-200'} p-6`}>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-4 italic`}>
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {testimonial.name}
                    </h4>
                    <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                      {testimonial.badge}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - StalkFun style */}
      <section className={`py-20 ${darkMode ? 'bg-gradient-to-br from-emerald-900 to-teal-900' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Discover Your Next Big Sale Before Everyone Else
          </h2>
          <p className="text-xl text-emerald-100 mb-8">
            Join thousands of successful resellers using Profit Orbit to grow their business.
          </p>
          <Button 
            onClick={handleGetStarted} 
            size="lg" 
            className="text-lg px-8 py-6 bg-white text-emerald-600 hover:bg-emerald-50 rounded-full font-bold shadow-2xl"
          >
            Login
          </Button>
        </div>
      </section>

      {/* Footer - StalkFun style */}
      <footer className={`${darkMode ? 'bg-[#0a0a0a] border-t border-gray-800' : 'bg-white border-t border-gray-200'} py-12`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Footer Top */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button 
                    onClick={() => scrollToSection('how-it-works')} 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    How it works
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => scrollToSection('features')} 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => scrollToSection('pricing')} 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    Pricing
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/FAQ" 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <a 
                    href="/FAQ" 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    Discord
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a 
                    href="/PrivacyPolicy" 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a 
                    href="/PrivacyPolicy" 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Get Started</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button 
                    onClick={handleGetStarted} 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    Sign Up
                  </button>
                </li>
                <li>
                  <button 
                    onClick={handleSignIn} 
                    className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
                  >
                    Login
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className={`border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} pt-8 flex flex-col md:flex-row items-center justify-between`}>
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Profit Orbit
              </span>
            </div>
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              © {new Date().getFullYear()} Profit Orbit. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

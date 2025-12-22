/**
 * Auth Guard Component
 * Protects routes that require authentication
 */

import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';

export function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let subscription = null;

    // Handle OAuth callback first - process hash fragment before checking auth
    const handleOAuthCallback = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('🔐 AuthGuard: OAuth callback detected, processing hash fragment...');
        
        // Wait for Supabase to process the hash fragment
        // Supabase automatically processes hash fragments on initialization
        // But we need to give it time to complete
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Clear the hash fragment after processing
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    const initializeAuth = async () => {
      // First, handle OAuth callback if present
      await handleOAuthCallback();
      
      // Then check auth status
      await checkAuth();

      // Listen for auth changes
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthenticated(!!session);
        setLoading(false);
      });

      subscription = authSubscription;
    };

    initializeAuth();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthenticated(!!session);
    } catch (error) {
      console.error('Auth check error:', error);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}



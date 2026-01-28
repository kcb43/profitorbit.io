/**
 * OAuth Diagnostic Page
 * Helps diagnose redirect_uri_mismatch errors
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/api/supabaseClient';
import { getPublicSiteOrigin } from '@/utils/publicSiteUrl';
import { ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OAuthDiagnostic() {
  const navigate = useNavigate();
  const [diagnosticInfo, setDiagnosticInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  const runDiagnostic = async () => {
    const info = {
      timestamp: new Date().toISOString(),
      environment: {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        anonKeyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 30) + '...',
        publicSiteOrigin: getPublicSiteOrigin(),
        windowOrigin: window.location.origin,
        windowHref: window.location.href,
      },
      oauthAttempt: null,
      error: null,
    };

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${getPublicSiteOrigin()}/dashboard`,
          skipBrowserRedirect: true, // Don't actually redirect
        },
      });

      if (data?.url) {
        const url = new URL(data.url);
        const redirectUri = url.searchParams.get('redirect_uri');
        
        info.oauthAttempt = {
          fullUrl: data.url,
          redirectUri: redirectUri,
          provider: data.provider,
        };
      }

      if (error) {
        info.error = {
          message: error.message,
          status: error.status,
          name: error.name,
        };
      }
    } catch (err) {
      info.error = {
        message: err.message,
        stack: err.stack,
      };
    }

    setDiagnosticInfo(info);
    console.log('🔍 Diagnostic Results:', info);
  };

  const copyToClipboard = () => {
    const text = JSON.stringify(diagnosticInfo, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">
            OAuth Diagnostic Tool
          </h1>
          <p className="text-gray-600 mb-6">
            This tool helps diagnose the "redirect_uri_mismatch" error by showing
            exactly what redirect URI is being sent to Google.
          </p>

          <Button
            onClick={runDiagnostic}
            className="bg-emerald-600 hover:bg-emerald-700 text-white mb-6"
            size="lg"
          >
            Run Diagnostic
          </Button>

          {diagnosticInfo && (
            <div className="space-y-6">
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Diagnostic Results
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                {/* Environment Info */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Environment Configuration
                  </h3>
                  <div className="bg-gray-50 rounded p-4 space-y-2 font-mono text-sm">
                    <div>
                      <span className="text-gray-600">Supabase URL:</span>
                      <div className="text-gray-900 font-semibold">
                        {diagnosticInfo.environment.supabaseUrl || '❌ NOT SET'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Anon Key:</span>
                      <div className="text-gray-900">
                        {diagnosticInfo.environment.anonKeyPrefix || '❌ NOT SET'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Public Site Origin:</span>
                      <div className="text-gray-900">
                        {diagnosticInfo.environment.publicSiteOrigin}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Window Origin:</span>
                      <div className="text-gray-900">
                        {diagnosticInfo.environment.windowOrigin}
                      </div>
                    </div>
                  </div>
                </div>

                {/* OAuth Attempt Info */}
                {diagnosticInfo.oauthAttempt && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-800">
                      OAuth Request Details
                    </h3>
                    <div className="bg-emerald-50 rounded p-4 space-y-3">
                      <div>
                        <span className="text-gray-600 text-sm block mb-1">
                          Redirect URI being sent to Google:
                        </span>
                        <div className="text-emerald-900 font-mono font-semibold text-lg break-all bg-white p-3 rounded border-2 border-emerald-200">
                          {diagnosticInfo.oauthAttempt.redirectUri}
                        </div>
                      </div>
                      <div className="pt-3 border-t border-emerald-200">
                        <span className="text-gray-600 text-sm">Full OAuth URL:</span>
                        <div className="text-gray-700 font-mono text-xs break-all mt-1">
                          {diagnosticInfo.oauthAttempt.fullUrl}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Info */}
                {diagnosticInfo.error && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-red-700">
                      Error Detected
                    </h3>
                    <div className="bg-red-50 rounded p-4 space-y-2 font-mono text-sm">
                      <div>
                        <span className="text-red-600">Message:</span>
                        <div className="text-red-900">
                          {diagnosticInfo.error.message}
                        </div>
                      </div>
                      {diagnosticInfo.error.status && (
                        <div>
                          <span className="text-red-600">Status:</span>
                          <div className="text-red-900">
                            {diagnosticInfo.error.status}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                  <h3 className="text-lg font-semibold mb-2 text-blue-900">
                    Next Steps
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-blue-900">
                    <li>
                      Copy the <strong>"Redirect URI being sent to Google"</strong> above
                    </li>
                    <li>
                      Go to:{' '}
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-700"
                      >
                        Google Cloud Console → Credentials
                      </a>
                    </li>
                    <li>
                      Find your OAuth 2.0 Client ID and click on it
                    </li>
                    <li>
                      Under <strong>"Authorized redirect URIs"</strong>, verify the redirect URI
                      from above is listed EXACTLY (no trailing slash, same capitalization)
                    </li>
                    <li>
                      If it's not there, add it and click "Save"
                    </li>
                    <li>
                      Wait 2-3 minutes for Google to update, then try signing in again
                    </li>
                  </ol>
                </div>

                {/* Raw JSON */}
                <details className="mt-6">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                    View Raw JSON
                  </summary>
                  <pre className="mt-3 bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-xs">
                    {JSON.stringify(diagnosticInfo, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

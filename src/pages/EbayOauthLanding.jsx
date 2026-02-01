import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Public landing page for eBay OAuth.
 *
 * Why this exists:
 * - Our main app routes are behind AuthGuard.
 * - When eBay redirects back with a token payload, we must store it BEFORE
 *   AuthGuard potentially redirects the user to /login.
 */
export default function EbayOauthLanding() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // Preserve theme immediately (same behavior as CrosslistComposer's OAuth handler)
    const preservedTheme = sessionStorage.getItem("preserved_theme");
    if (preservedTheme) {
      try {
        localStorage.setItem("theme", preservedTheme);
        document.documentElement.setAttribute("data-theme", preservedTheme);
        window.dispatchEvent(new Event("storage"));
      } catch (_) {
        // ignore
      }
      try {
        sessionStorage.removeItem("preserved_theme");
      } catch (_) {
        // ignore
      }
    }

    // Success path
    if (params.get("ebay_auth_success") === "1") {
      const tokenParam = params.get("token");
      if (tokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenParam));
          const expiresAt = Date.now() + Number(tokenData.expires_in || 0) * 1000;
          const tokenToStore = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            expires_in: tokenData.expires_in,
            refresh_token_expires_in: tokenData.refresh_token_expires_in,
            token_type: tokenData.token_type,
          };
          localStorage.setItem("ebay_user_token", JSON.stringify(tokenToStore));
        } catch (e) {
          // If we can't parse/store, fall through to error redirect
          params.set("ebay_auth_error", "Failed to parse eBay token payload");
        }
      } else {
        params.set("ebay_auth_error", "Missing token payload from eBay OAuth callback");
      }
    }

    // Redirect back into the app.
    // Check if there's a saved return path (e.g., from Import page)
    const returnPath = sessionStorage.getItem('ebay_oauth_return');
    if (returnPath) {
      sessionStorage.removeItem('ebay_oauth_return');
      const qs = params.toString();
      navigate(`${returnPath}${qs ? `${returnPath.includes('?') ? '&' : '?'}${qs}` : ""}`, { replace: true });
    } else {
      // Default: Prefer CrosslistComposer because it already knows how to restore `ebay_oauth_state` if present.
      const qs = params.toString();
      navigate(`/CrosslistComposer${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Connecting eBay…</div>
      <div style={{ marginTop: 8, opacity: 0.8 }}>You can close this tab if it doesn’t redirect within a few seconds.</div>
    </div>
  );
}



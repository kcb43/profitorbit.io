/**
 * Canonical public site URL helper.
 *
 * In production we want OAuth redirects to land on `orben.io` (custom domain),
 * not a Vercel preview domain. This prevents "logged out after reopening" issues
 * caused by sessions being persisted on a different origin.
 */

export function getPublicSiteOrigin() {
  const configured = (import.meta.env.VITE_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to window origin
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
}



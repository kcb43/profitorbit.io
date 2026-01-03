import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";

function parseAdminUserIds(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const FALLBACK_ADMIN_USER_IDS = [
  // Project owner / initial admin (used elsewhere for admin-only actions)
  "82bdb1aa-b2d2-4001-80ef-1196e5563cb9",
];

export function AdminGuard({ children }) {
  const adminIds = useMemo(() => {
    const fromEnv = parseAdminUserIds(import.meta.env.VITE_ADMIN_USER_IDS);
    return fromEnv.length ? fromEnv : FALLBACK_ADMIN_USER_IDS;
  }, []);

  const [state, setState] = useState({ loading: true, allowed: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data?.session?.user?.id || null;
      const allowed = Boolean(userId && adminIds.includes(userId));
      if (alive) setState({ loading: false, allowed });
    })();
    return () => {
      alive = false;
    };
  }, [adminIds]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!state.allowed) return <Navigate to="/dashboard" replace />;

  return children;
}



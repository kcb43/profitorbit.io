import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const SelectionBannerContext = createContext(null);

export function SelectionBannerProvider({ children }) {
  const [bannerState, setBannerState] = useState(null);

  const register = useCallback((state) => {
    setBannerState(state);
  }, []);

  const unregister = useCallback(() => {
    setBannerState(null);
  }, []);

  return (
    <SelectionBannerContext.Provider value={{ bannerState, register, unregister }}>
      {children}
    </SelectionBannerContext.Provider>
  );
}

/**
 * Called by Layout.jsx to read selection banner state.
 */
export function useSelectionBannerState() {
  const ctx = useContext(SelectionBannerContext);
  return ctx?.bannerState || null;
}

/**
 * Called by pages (Inventory, SalesHistory, etc.) to register their selection state.
 * Uses a ref for children to avoid re-render loops.
 */
export function useRegisterSelectionBanner({ selectedCount, onClear, children }) {
  const ctx = useContext(SelectionBannerContext);
  const childrenRef = useRef(children);
  const onClearRef = useRef(onClear);
  childrenRef.current = children;
  onClearRef.current = onClear;

  React.useEffect(() => {
    if (!ctx) return;
    if (selectedCount > 0) {
      ctx.register({
        selectedCount,
        get onClear() { return onClearRef.current; },
        get children() { return childrenRef.current; },
      });
    } else {
      ctx.unregister();
    }
    return () => ctx.unregister();
  }, [selectedCount, ctx]);
}

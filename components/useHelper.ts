"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCapabilities,
  fetchHelperStatus,
  isMacPlatform,
  type HelperStatus,
  type HelperCapabilities,
} from "@/lib/helper";

export type HelperUiState =
  | { kind: "checking" }
  | { kind: "non-mac" }
  | { kind: "missing" }
  | { kind: "setup"; status: HelperStatus }
  | { kind: "connected"; capabilities: HelperCapabilities; status: HelperStatus };

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const withUserData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return isMacPlatform(withUserData.userAgentData?.platform ?? navigator.platform);
}

/** Detect Folio for Mac and keep the page ready for a just-launched app. */
export function useHelper(): {
  state: HelperUiState;
  refresh: () => void;
  isMac: boolean;
} {
  const [isMac] = useState(detectMac);
  const [state, setState] = useState<HelperUiState>(() =>
    isMac ? { kind: "checking" } : { kind: "non-mac" },
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isMac) return;
    let cancelled = false;
    const check = async () => {
      const status = await fetchHelperStatus();
      if (cancelled) return;
      if (!status) {
        // Keep this copy deliberately broad: a browser cannot distinguish a
        // missing app from a TLS listener that has not finished setup.
        setState({ kind: "missing" });
        return;
      }
      if (status.setup === "setup-required" || status.setup === "starting") {
        setState({ kind: "setup", status });
        return;
      }
      const caps = await fetchCapabilities();
      if (cancelled) return;
      if (!caps) setState({ kind: "missing" });
      else setState({ kind: "connected", capabilities: caps, status });
    };
    void check();
    const interval = window.setInterval(() => void check(), 6000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [nonce, isMac]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { state, refresh, isMac };
}

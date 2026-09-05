"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCapabilities,
  isMacPlatform,
  probeHelper,
  type HelperCapabilities,
} from "@/lib/helper";

export type HelperUiState =
  | { kind: "checking" }
  | { kind: "non-mac" }
  | { kind: "missing" }
  | { kind: "connected"; capabilities: HelperCapabilities };

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const withUserData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return isMacPlatform(withUserData.userAgentData?.platform ?? navigator.platform);
}

/** Detect Folio for Mac helper availability. Lightweight; one probe per mount. */
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
    (async () => {
      const up = await probeHelper();
      if (cancelled) return;
      if (!up) {
        setState({ kind: "missing" });
        return;
      }
      const caps = await fetchCapabilities();
      if (cancelled) return;
      if (!caps) setState({ kind: "missing" });
      else setState({ kind: "connected", capabilities: caps });
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce, isMac]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { state, refresh, isMac };
}

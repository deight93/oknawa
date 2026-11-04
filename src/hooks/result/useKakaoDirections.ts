'use client';

import { useCallback, useEffect, useRef, type MouseEvent } from 'react';
import {
  getKakaoAppLaunchUrl,
  type KakaoDirections,
} from '@/utils/kakaoDirections';

type LinkClick = Pick<
  MouseEvent<HTMLAnchorElement>,
  | 'button'
  | 'metaKey'
  | 'ctrlKey'
  | 'shiftKey'
  | 'altKey'
  | 'defaultPrevented'
  | 'preventDefault'
>;

const FALLBACK_DELAY_MS = 2000;
const CHECK_INTERVAL_MS = 250;
const MAX_CHECK_GAP_MS = 750;

export default function useKakaoDirections(contextKey: string) {
  const pendingCleanup = useRef<(() => void) | null>(null);
  const cancelPendingDirections = useCallback(() => {
    pendingCleanup.current?.();
    pendingCleanup.current = null;
  }, []);

  useEffect(
    () => cancelPendingDirections,
    [contextKey, cancelPendingDirections],
  );

  const openDirections = (event: LinkClick, directions: KakaoDirections) => {
    cancelPendingDirections();
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    const launchUrl = getKakaoAppLaunchUrl(directions, navigator);
    // Keep ordinary anchors on desktop, including opening a new tab.
    if (!launchUrl) return;
    event.preventDefault();

    const startedAt = Date.now();
    let lastCheckAt = startedAt;
    const cancelWhenHidden = () => {
      if (document.visibilityState === 'hidden') cancelPendingDirections();
    };
    const checkFallback = () => {
      const now = Date.now();
      // OS dialogs may suspend timers without lifecycle events. A missed check
      // cancels automatic navigation; the explicit web link remains available.
      if (
        document.visibilityState !== 'visible' ||
        !document.hasFocus() ||
        now - lastCheckAt > MAX_CHECK_GAP_MS ||
        now < lastCheckAt
      ) {
        cancelPendingDirections();
        return;
      }
      if (now - startedAt >= FALLBACK_DELAY_MS) {
        cancelPendingDirections();
        window.location.assign(directions.webUrl);
        return;
      }
      lastCheckAt = now;
      timer = window.setTimeout(checkFallback, CHECK_INTERVAL_MS);
    };
    let timer = window.setTimeout(checkFallback, CHECK_INTERVAL_MS);
    pendingCleanup.current = () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', cancelWhenHidden);
      window.removeEventListener('pagehide', cancelPendingDirections);
      window.removeEventListener('blur', cancelPendingDirections);
    };
    document.addEventListener('visibilitychange', cancelWhenHidden);
    window.addEventListener('pagehide', cancelPendingDirections);
    window.addEventListener('blur', cancelPendingDirections);
    try {
      // Must remain synchronous with the user gesture for mobile browsers.
      window.location.assign(launchUrl);
    } catch {
      cancelPendingDirections();
      window.location.assign(directions.webUrl);
    }
  };

  return { openDirections, cancelPendingDirections };
}

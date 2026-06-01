import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";

const EDGE_ZONE = 28;
const ENGAGE_SLOP = 10;
const COMMIT_FRACTION = 0.3;
const COMMIT_MIN_PX = 70;

/**
 * Wraps the routed content and adds an iOS-style edge swipe-back gesture for
 * touch devices. Tracks in-app navigation depth (via popstate) so the gesture
 * only fires when there is a previous in-app page to return to — never swiping
 * out of the app — and stays inert on the map root.
 */
function isRootMap(path: string): boolean {
  return path === "/" || path === "/map";
}

export function SwipeBack({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const canGoBackRef = useRef(false);
  const depthRef = useRef(0);
  const poppedRef = useRef(false);
  const firstRef = useRef(true);

  // popstate (incl. our own history.back()) fires before React effects run,
  // so we can tag the next location change as a pop vs a forward push.
  useEffect(() => {
    function onPop() {
      poppedRef.current = true;
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
    } else if (poppedRef.current) {
      depthRef.current = Math.max(0, depthRef.current - 1);
    } else {
      depthRef.current += 1;
    }
    poppedRef.current = false;
    canGoBackRef.current = depthRef.current > 0 && !isRootMap(location);
  }, [location]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const engaged = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dx = useRef(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function settle(animate: boolean) {
      const node = wrapRef.current;
      if (!node) return;
      node.style.transition = animate ? "transform 0.2s ease-out" : "";
      node.style.transform = "";
      node.style.boxShadow = "";
    }

    function onStart(e: TouchEvent) {
      if (!canGoBackRef.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE) return;
      dragging.current = true;
      engaged.current = false;
      startX.current = t.clientX;
      startY.current = t.clientY;
      dx.current = 0;
      const node = wrapRef.current;
      if (node) node.style.transition = "";
    }

    function onMove(e: TouchEvent) {
      if (!dragging.current) return;
      const t = e.touches[0];
      const moveX = t.clientX - startX.current;
      const moveY = t.clientY - startY.current;

      if (!engaged.current) {
        if (Math.abs(moveX) < ENGAGE_SLOP && Math.abs(moveY) < ENGAGE_SLOP) return;
        if (Math.abs(moveY) >= Math.abs(moveX)) {
          dragging.current = false;
          return;
        }
        engaged.current = true;
      }

      if (moveX < 0) {
        dx.current = 0;
        const node = wrapRef.current;
        if (node) node.style.transform = "";
        return;
      }

      dx.current = moveX;
      e.preventDefault();
      const node = wrapRef.current;
      if (node) {
        node.style.transform = `translateX(${moveX}px)`;
        node.style.boxShadow = "-12px 0 28px rgba(0,0,0,0.14)";
      }
    }

    function onEnd() {
      if (!dragging.current) return;
      dragging.current = false;
      engaged.current = false;
      const width = window.innerWidth || 1;
      const committed =
        dx.current > Math.max(COMMIT_MIN_PX, width * COMMIT_FRACTION);

      if (committed) {
        const node = wrapRef.current;
        if (node) {
          node.style.transition = "transform 0.18s ease-out";
          node.style.transform = `translateX(${width}px)`;
        }
        window.setTimeout(() => {
          window.history.back();
          window.setTimeout(() => settle(false), 60);
        }, 170);
      } else {
        settle(true);
      }
      dx.current = 0;
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div ref={wrapRef} className="flex-1 flex flex-col min-h-0 will-change-transform">
      {children}
    </div>
  );
}

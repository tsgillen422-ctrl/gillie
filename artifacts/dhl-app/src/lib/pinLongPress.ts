// Press-and-hold ("long press") gesture decision logic for dropping a map pin.
//
// This is deliberately framework- and map-agnostic so it can be unit-tested
// without a real MapLibre instance or WebGL (the e2e harness has no WebGL, so
// the map page can't be exercised end-to-end). The map page wires these
// callbacks to its touch/mouse events; the timing/threshold rules live here.

// How long a finger must stay down (ms) before the pin dialog fires.
export const LONG_PRESS_MS = 550;
// How far the pointer may drift (px, per-axis) before the press is treated as a
// drag/pan and cancelled.
export const LONG_PRESS_MOVE_THRESHOLD_PX = 8;

export interface LongPressPoint {
  x: number;
  y: number;
}

export interface PinLongPressOptions<TLngLat> {
  // Called once a stationary hold completes. Receives the lng/lat captured at
  // the moment the press began.
  onLongPress: (lngLat: TLngLat) => void;
  // Hold duration before firing. Defaults to LONG_PRESS_MS.
  durationMs?: number;
  // Per-axis movement threshold that cancels the press. Defaults to
  // LONG_PRESS_MOVE_THRESHOLD_PX.
  moveThresholdPx?: number;
  // Injectable timer so tests can drive a fake clock. Default to window timers.
  setTimer?: (cb: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface PinLongPressController<TLngLat> {
  // A generic single-pointer press began (e.g. mouse down). Arms the timer.
  pointerDown: (point: LongPressPoint, lngLat: TLngLat) => void;
  // A touch began. Only a single finger arms the press — any multi-finger
  // touch (pinch-zoom) cancels it.
  touchStart: (pointCount: number, point: LongPressPoint, lngLat: TLngLat) => void;
  // The pointer moved. Cancels the press if it drifts past the threshold.
  move: (point: LongPressPoint) => void;
  // Cancel the in-flight press (drag start, zoom start, touch/mouse up, etc.).
  cancel: () => void;
  // Whether a press is currently armed (timer pending). Mainly for tests.
  isArmed: () => boolean;
}

export function createPinLongPress<TLngLat>(
  opts: PinLongPressOptions<TLngLat>,
): PinLongPressController<TLngLat> {
  const duration = opts.durationMs ?? LONG_PRESS_MS;
  const threshold = opts.moveThresholdPx ?? LONG_PRESS_MOVE_THRESHOLD_PX;
  const setTimer =
    opts.setTimer ?? ((cb, ms) => window.setTimeout(cb, ms) as unknown as number);
  const clearTimer = opts.clearTimer ?? ((id) => window.clearTimeout(id));

  let timer: number | null = null;
  let start: LongPressPoint | null = null;

  const cancel = () => {
    if (timer != null) {
      clearTimer(timer);
      timer = null;
    }
    start = null;
  };

  const begin = (point: LongPressPoint, lngLat: TLngLat) => {
    cancel();
    start = { x: point.x, y: point.y };
    timer = setTimer(() => {
      timer = null;
      start = null;
      opts.onLongPress(lngLat);
    }, duration);
  };

  return {
    pointerDown: begin,
    touchStart: (pointCount, point, lngLat) => {
      if (pointCount !== 1) {
        cancel();
        return;
      }
      begin(point, lngLat);
    },
    move: (point) => {
      if (
        start &&
        (Math.abs(point.x - start.x) > threshold ||
          Math.abs(point.y - start.y) > threshold)
      ) {
        cancel();
      }
    },
    cancel,
    isArmed: () => timer != null,
  };
}

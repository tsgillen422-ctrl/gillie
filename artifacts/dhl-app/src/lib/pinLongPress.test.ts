import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPinLongPress,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_THRESHOLD_PX,
} from "./pinLongPress.ts";

// A controllable fake clock so tests can decide exactly when (and whether) the
// long-press timer fires, without waiting ~550ms of wall-clock time.
function fakeClock() {
  let nextId = 1;
  const timers = new Map<number, () => void>();
  return {
    setTimer: (cb: () => void) => {
      const id = nextId++;
      timers.set(id, cb);
      return id;
    },
    clearTimer: (id: number) => {
      timers.delete(id);
    },
    // Fire every pending timer (simulates enough time elapsing).
    flush: () => {
      for (const cb of [...timers.values()]) cb();
      timers.clear();
    },
    pending: () => timers.size,
  };
}

const LNG_LAT = { lat: 42.5, lng: -83.5 };

test("a stationary hold fires the pin dialog with the captured lng/lat", () => {
  const clock = fakeClock();
  const fired: Array<typeof LNG_LAT> = [];
  const lp = createPinLongPress<typeof LNG_LAT>({
    onLongPress: (ll) => fired.push(ll),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  lp.touchStart(1, { x: 100, y: 100 }, LNG_LAT);
  assert.equal(lp.isArmed(), true);
  clock.flush();

  assert.deepEqual(fired, [LNG_LAT]);
  assert.equal(lp.isArmed(), false);
});

test("a quick tap (release before the timer) does NOT fire", () => {
  const clock = fakeClock();
  let fired = 0;
  const lp = createPinLongPress({
    onLongPress: () => fired++,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  lp.touchStart(1, { x: 100, y: 100 }, LNG_LAT);
  // Finger lifts (touchend / mouseup) before the hold completes.
  lp.cancel();
  clock.flush();

  assert.equal(fired, 0);
  assert.equal(clock.pending(), 0);
});

test("a drag/pan past the move threshold does NOT fire", () => {
  const clock = fakeClock();
  let fired = 0;
  const lp = createPinLongPress({
    onLongPress: () => fired++,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  lp.pointerDown({ x: 100, y: 100 }, LNG_LAT);
  // Move beyond the per-axis threshold — this is a pan, not a press.
  lp.move({ x: 100 + LONG_PRESS_MOVE_THRESHOLD_PX + 1, y: 100 });
  assert.equal(lp.isArmed(), false);
  clock.flush();

  assert.equal(fired, 0);
});

test("a small jitter within the threshold still fires", () => {
  const clock = fakeClock();
  let fired = 0;
  const lp = createPinLongPress({
    onLongPress: () => fired++,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  lp.pointerDown({ x: 100, y: 100 }, LNG_LAT);
  // Within the threshold on both axes — should NOT cancel.
  lp.move({ x: 100 + LONG_PRESS_MOVE_THRESHOLD_PX, y: 100 - LONG_PRESS_MOVE_THRESHOLD_PX });
  assert.equal(lp.isArmed(), true);
  clock.flush();

  assert.equal(fired, 1);
});

test("a two-finger touch does NOT arm a press", () => {
  const clock = fakeClock();
  let fired = 0;
  const lp = createPinLongPress({
    onLongPress: () => fired++,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  lp.touchStart(2, { x: 100, y: 100 }, LNG_LAT);
  assert.equal(lp.isArmed(), false);
  clock.flush();

  assert.equal(fired, 0);
});

test("a second finger landing mid-press cancels the armed press", () => {
  const clock = fakeClock();
  let fired = 0;
  const lp = createPinLongPress({
    onLongPress: () => fired++,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  lp.touchStart(1, { x: 100, y: 100 }, LNG_LAT);
  assert.equal(lp.isArmed(), true);
  // A pinch begins — second finger reported as a 2-point touch.
  lp.touchStart(2, { x: 120, y: 120 }, LNG_LAT);
  assert.equal(lp.isArmed(), false);
  clock.flush();

  assert.equal(fired, 0);
});

test("cancel on drag/zoom/touchend disarms the press", () => {
  for (const stop of ["dragstart", "zoomstart", "touchend"] as const) {
    const clock = fakeClock();
    let fired = 0;
    const lp = createPinLongPress({
      onLongPress: () => fired++,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });

    lp.touchStart(1, { x: 50, y: 50 }, LNG_LAT);
    assert.equal(lp.isArmed(), true, `${stop}: armed`);
    lp.cancel(); // map wires dragstart/zoomstart/touchend/mouseup all to cancel
    assert.equal(lp.isArmed(), false, `${stop}: disarmed`);
    clock.flush();
    assert.equal(fired, 0, `${stop}: did not fire`);
  }
});

test("starting a new press replaces (does not stack) the previous timer", () => {
  const clock = fakeClock();
  const fired: Array<typeof LNG_LAT> = [];
  const lp = createPinLongPress<typeof LNG_LAT>({
    onLongPress: (ll) => fired.push(ll),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  const second = { lat: 1, lng: 2 };
  lp.pointerDown({ x: 0, y: 0 }, LNG_LAT);
  lp.pointerDown({ x: 0, y: 0 }, second);
  assert.equal(clock.pending(), 1);
  clock.flush();

  assert.deepEqual(fired, [second]);
});

test("exposes the documented timing/threshold constants", () => {
  assert.equal(LONG_PRESS_MS, 550);
  assert.equal(LONG_PRESS_MOVE_THRESHOLD_PX, 8);
});

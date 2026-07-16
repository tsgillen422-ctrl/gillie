import { Capacitor } from "@capacitor/core";
import {
  registerNativePush,
  unregisterNativePush,
} from "@workspace/api-client-react";

const ENABLED_KEY = "dhl.nativePush.enabled";
const TOKEN_KEY = "dhl.nativePush.token";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

async function getPlugin() {
  const mod = await import("@capacitor/push-notifications");
  return mod.PushNotifications;
}

/** Wraps a promise with a hard timeout so bridge hangs don't disable the UI forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label}`)), ms),
    ),
  ]);
}

/**
 * Request native notification permission, register with APNs, and persist the
 * resulting device token on the server. Throws Error("denied") when the user
 * declines. Resolves once the token is registered.
 */
export async function enableNativePush(): Promise<void> {
  const PushNotifications = await withTimeout(
    getPlugin(),
    8000,
    "getPlugin",
  );

  // checkPermissions should resolve in <1 s; 8 s guard prevents a frozen bridge
  // from leaving the Enable button permanently disabled.
  let perm = await withTimeout(
    PushNotifications.checkPermissions(),
    8000,
    "checkPermissions",
  );
  console.log("[native-push] checkPermissions →", perm.receive);

  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    // requestPermissions shows the iOS dialog — no hard timeout here so the user
    // has time to read it. A 120 s guard catches a silent hang (dialog never shown).
    perm = await withTimeout(
      PushNotifications.requestPermissions(),
      120_000,
      "requestPermissions",
    );
    console.log("[native-push] requestPermissions →", perm.receive);
  }

  if (perm.receive !== "granted") throw new Error("denied");

  // Register with APNs. Await the addListener calls BEFORE calling register()
  // so we never miss the token event (avoids the race where the token fires
  // before the JS listener is attached).
  const token = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const timeout = setTimeout(
      () => {
        console.error("[native-push] registration timed out after 15 s");
        done(() => reject(new Error("registration_timeout")));
      },
      15_000,
    );

    Promise.all([
      PushNotifications.addListener("registration", (t) => {
        console.log("[native-push] registration token received");
        clearTimeout(timeout);
        done(() => resolve(t.value));
      }),
      PushNotifications.addListener("registrationError", (err) => {
        console.error("[native-push] registrationError", err);
        clearTimeout(timeout);
        done(() => reject(new Error("registration_failed")));
      }),
    ])
      .then(() => {
        console.log("[native-push] listeners ready — calling register()");
        void PushNotifications.register();
      })
      .catch((err) => {
        console.error("[native-push] addListener failed", err);
        clearTimeout(timeout);
        done(() => reject(new Error("registration_failed")));
      });
  });

  await registerNativePush({ token, platform: "ios" });
  localStorage.setItem(ENABLED_KEY, "1");
  localStorage.setItem(TOKEN_KEY, token);
  console.log("[native-push] enabled — token saved");
}

/** Remove the device token from the server and mark native push as off. */
export async function disableNativePush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(ENABLED_KEY);
  if (token) {
    try {
      await unregisterNativePush({ token });
    } catch {
      /* best-effort server cleanup */
    }
  }
}

export async function isNativePushEnabled(): Promise<boolean> {
  if (localStorage.getItem(ENABLED_KEY) !== "1") return false;
  try {
    const PushNotifications = await getPlugin();
    const perm = await withTimeout(PushNotifications.checkPermissions(), 5000, "checkPermissions-status");
    return perm.receive === "granted";
  } catch {
    return false;
  }
}

let listenersInitialized = false;

/** Wire up tap-to-navigate when a native notification is opened. */
export async function initNativePushListeners(): Promise<void> {
  if (!isNativePlatform() || listenersInitialized) return;
  listenersInitialized = true;
  const PushNotifications = await getPlugin();
  void PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      const data = action.notification?.data as { url?: unknown } | undefined;
      const url = data?.url;
      if (typeof url === "string" && url.length > 0) {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        window.location.href = base + url;
      }
    },
  );
}

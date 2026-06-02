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

/**
 * Request native notification permission, register with APNs, and persist the
 * resulting device token on the server. Throws Error("denied") when the user
 * declines. Resolves once the token is registered.
 */
export async function enableNativePush(): Promise<void> {
  const PushNotifications = await getPlugin();

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") throw new Error("denied");

  const token = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    void PushNotifications.addListener("registration", (t) =>
      done(() => resolve(t.value)),
    );
    void PushNotifications.addListener("registrationError", () =>
      done(() => reject(new Error("registration_failed"))),
    );
    void PushNotifications.register();
    setTimeout(
      () => done(() => reject(new Error("registration_timeout"))),
      15000,
    );
  });

  await registerNativePush({ token, platform: "ios" });
  localStorage.setItem(ENABLED_KEY, "1");
  localStorage.setItem(TOKEN_KEY, token);
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
    const perm = await PushNotifications.checkPermissions();
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

import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
} from "@workspace/api-client-react";

const SW_URL = `${import.meta.env.BASE_URL}sw.js`;
const SW_SCOPE = import.meta.env.BASE_URL;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPermission(): NotificationPermission | null {
  return isPushSupported() ? Notification.permission : null;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration(SW_SCOPE)) ?? null;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  } catch (err) {
    console.error("Service worker registration failed", err);
    return null;
  }
}

export async function isPushEnabled(): Promise<boolean> {
  const reg = await getServiceWorkerRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return sub != null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function serialize(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

/**
 * Request notification permission, register the service worker, subscribe to
 * push, and persist the subscription on the server.
 * Throws Error("unsupported") or Error("denied") for the common failure paths.
 */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error("unsupported");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");

  await registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await getVapidPublicKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await subscribePush(serialize(sub));
}

/** Unsubscribe locally and remove the subscription from the server. */
export async function disablePush(): Promise<void> {
  const reg = await getServiceWorkerRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await unsubscribePush({ endpoint });
  } catch (e) {
    /* best-effort server cleanup */
  }
}

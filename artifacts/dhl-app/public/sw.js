/* Web push service worker for Gillie */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Gillie";
  const options = {
    body: data.body || "",
    icon: new URL("logo.svg", self.registration.scope).href,
    badge: new URL("favicon.svg", self.registration.scope).href,
    data: { url: data.url || "/" },
    tag: data.type || undefined,
    renotify: Boolean(data.type),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl =
    (event.notification.data && event.notification.data.url) || "/";
  const path = String(rawUrl).replace(/^\//, "");
  const target = new URL(path, self.registration.scope).href;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch (e) {
              /* ignore navigation errors */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

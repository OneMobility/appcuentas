// Service Worker para Oinkash
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Oinkash 🐷';
  const options = {
    body: data.body || 'Tienes una nueva actualización financiera.',
    icon: 'https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%203%20ago%202026,%2003_44_08%20p.m..png',
    badge: 'https://nyzquoiwwywbqbhdowau.supabase.co/storage/v1/object/public/Media/ChatGPT%20Image%203%20ago%202026,%2003_44_08%20p.m..png',
    vibrate: [100, 50, 100],
    data: {
      url: data.link || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
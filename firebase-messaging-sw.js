importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDWlH9BJSy0vLDxSt3OX8FpS7mck_KOx7A",
    authDomain: "my-chat-9be7c.firebaseapp.com",
    databaseURL: "https://my-chat-9be7c-default-rtdb.firebaseio.com",
    projectId: "my-chat-9be7c",
    storageBucket: "my-chat-9be7c.firebasestorage.app",
    messagingSenderId: "350321042515",
    appId: "1:350321042515:web:86519f0278d52b587792a6",
    measurementId: "G-B4EWB0TLMG"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.chatId || 'chat-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open_chat',
        title: 'Open Chat',
        icon: '/logo192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      chatId: payload.data?.chatId,
      senderId: payload.data?.senderId,
      senderName: payload.data?.senderName,
      url: payload.data?.click_action
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/';
  
  // This looks to see if the current window is already open and focuses if it is
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('my-new-chat-app') && 'focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

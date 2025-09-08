import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

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


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app); // Realtime Database को जोड़ें
const messaging = getMessaging(app);

// Register service worker for Firebase Messaging
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('[DEBUG] Service Worker registered successfully:', registration);
    })
    .catch((error) => {
      console.error('[DEBUG] Service Worker registration failed:', error);
    });
} else {
  console.warn('[DEBUG] Service Worker not supported in this browser.');
}

// Request notification permission
const requestNotificationPermission = async () => {
  try {
    console.log('[DEBUG] Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('[DEBUG] Notification permission status:', permission);
    if (permission === 'granted') {
      console.log('[DEBUG] Notification permission granted.');
    } else {
      console.warn('[DEBUG] Notification permission not granted.');
    }
  } catch (error) {
    console.error('[DEBUG] Error requesting notification permission:', error);
  }
};

requestNotificationPermission();

export { auth, db, rtdb, messaging }; // rtdb को एक्सपोर्ट करें

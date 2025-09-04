import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

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

export { auth, db, rtdb }; // rtdb को एक्सपोर्ट करें

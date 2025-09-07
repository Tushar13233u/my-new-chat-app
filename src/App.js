import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, useMediaQuery } from '@mui/material';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, rtdb, messaging, db } from './firebase/config';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import Login from './pages/Login';
import PrivateChatRoom from './pages/PrivateChatRoom';
import Profile from './pages/Profile';
import HomePage from './pages/HomePage';
import UserList from './pages/UserList';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6750A4',
    },
    secondary: {
      main: '#625B71',
    },
    background: {
      default: '#FFFBFE',
      paper: '#FFFBFE',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#D0BCFF',
    },
    secondary: {
      main: '#CCC2DC',
    },
    background: {
      default: '#1C1B1F',
      paper: 'rgba(48, 47, 53, 0.5)',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backdropFilter: 'blur(10px)',
        },
      },
    },
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = React.useMemo(
    () => (prefersDarkMode ? darkTheme : lightTheme),
    [prefersDarkMode],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);

      if (user) {
        const userStatusDatabaseRef = ref(rtdb, '/status/' + user.uid);
        const isOfflineForDatabase = {
          state: 'offline',
          last_changed: serverTimestamp(),
        };
        const isOnlineForDatabase = {
          state: 'online',
          last_changed: serverTimestamp(),
        };

        onValue(ref(rtdb, '.info/connected'), (snapshot) => {
          if (snapshot.val() === false) {
            return;
          }
          onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
            set(userStatusDatabaseRef, isOnlineForDatabase);
          });
        });
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (user) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            console.log('Notification permission granted.');
            // VAPID key from Firebase console
            const token = await getToken(messaging, { vapidKey: 'BMtlpDpByOD2lwV3QgeAG99ONZzW8g3GwrXevd_gSucWToG3KLJ0kLx95t2Kulm52ovP9riMaitB6Qrkw0_jYsWY' });
            if (token) {
              console.log('FCM Token:', token);
              const userDocRef = doc(db, 'users', user.uid);
              await setDoc(userDocRef, { fcmToken: token }, { merge: true });
            } else {
              console.log('No registration token available. Request permission to generate one.');
            }
          } else {
            console.log('Unable to get permission to notify.');
          }
        } catch (error) {
          console.error('An error occurred while retrieving token. ', error);
        }
      }
    };

    requestNotificationPermission();
  }, [user]);

  useEffect(() => {
    if (user) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);
        
        // Show notification even when app is in foreground
        if (Notification.permission === 'granted') {
          const notification = new Notification(
            payload.notification?.title || 'New Message',
            {
              body: payload.notification?.body || 'You have a new message',
              icon: '/logo192.png',
              badge: '/logo192.png',
              tag: payload.data?.chatId || 'chat-notification',
              requireInteraction: false,
              data: payload.data
            }
          );

          notification.onclick = function() {
            window.focus();
            if (payload.data?.click_action) {
              window.location.href = payload.data.click_action;
            }
            notification.close();
          };

          // Auto close after 5 seconds
          setTimeout(() => notification.close(), 5000);
        }
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      console.log('🔔 Setting up notification listener for user:', user.uid);
      
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef, 
        where('receiverId', '==', user.uid),
        where('read', '==', false)
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        console.log('📬 Notification snapshot received, changes:', querySnapshot.docChanges().length);
        
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notificationData = change.doc.data();
            console.log('🔔 New notification received:', notificationData);
            
            // Show browser notification
            if (Notification.permission === 'granted') {
              console.log('✅ Showing browser notification');
              const notification = new Notification(
                `💬 ${notificationData.senderName || 'New Message'}`,
                {
                  body: notificationData.message,
                  icon: '/logo192.png',
                  tag: 'chat-notification',
                  requireInteraction: false
                }
              );

              notification.onclick = function() {
                window.focus();
                window.location.href = `/#/chat?uid=${notificationData.senderId}`;
                notification.close();
              };

              // Auto close after 5 seconds
              setTimeout(() => notification.close(), 5000);
            } else {
              console.log('❌ Notification permission not granted');
            }

            // Mark notification as read
            const notificationRef = doc(db, 'notifications', change.doc.id);
            setDoc(notificationRef, { read: true }, { merge: true });
          }
        });
      });

      return () => unsubscribe();
    }
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
  <HashRouter>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <Login />} 
          />
          <Route 
            path="/chat/:userId" 
            element={user ? <PrivateChatRoom user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/profile" 
            element={user ? <Profile /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/users" 
            element={user ? <UserList /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/" 
            element={user ? <HomePage /> : <Navigate to="/login" />} 
          />
        </Routes>
  </HashRouter>
    </ThemeProvider>
  );
}

export default App;

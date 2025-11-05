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
import GeminiChatRoom from './pages/GeminiChatRoom';
import { Snackbar, Alert } from '@mui/material';
import { useLocation, Outlet } from 'react-router-dom';
import './App.css'; // Import the new CSS file

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#008069', // WhatsApp green
    },
    secondary: {
      main: '#25D366', // Lighter green for accents
    },
    background: {
      default: '#e5ddd5', // Chat background
      paper: '#ffffff', // White for cards/surfaces
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
  shape: {
    borderRadius: 8, // Slightly less rounded
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#075E54', // Darker WhatsApp green
    },
    secondary: {
      main: '#128C7E', // Darker accent green
    },
    background: {
      default: '#1C1B1F', // Dark background
      paper: '#262D31', // Darker paper for surfaces
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
  shape: {
    borderRadius: 8, // Slightly less rounded
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          // backdropFilter: 'blur(10px)', // Removed
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          // backdropFilter: 'blur(10px)', // Removed
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          // backdropFilter: 'blur(10px)', // Removed
        },
      },
    },
  },
});

function MainLayout({ user, theme }) {
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  // Determine if the sidebar (HomePage) should be visible
  // On mobile, HomePage is visible when path is '/' or '/users'
  // On desktop, HomePage is always visible
  const showSidebar = !isMobile || (location.pathname === '/' || location.pathname === '/users');

  // Determine if the chat main container (PrivateChatRoom, GeminiChatRoom) should be visible
  // On mobile, it's visible when path is '/chat/:userId' or '/gemini-chat'
  // On desktop, it's always visible
  const showChatMain = !isMobile || (location.pathname.startsWith('/chat/') || location.pathname === '/gemini-chat');

  return (
    <Box className="app-container">
      {showSidebar && (
        <Box className="sidebar-container">
          <HomePage user={user} />
        </Box>
      )}
      {showChatMain && (
        <Box className="chat-main-container">
          <Outlet /> {/* This will render PrivateChatRoom or GeminiChatRoom */}
        </Box>
      )}
    </Box>
  );
}

function AppContent({ user, loading, theme }) {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
  const location = useLocation();

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

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

            // Check if the user is currently in the chat with the sender
            const currentChatPath = `/chat/${notificationData.senderId}`;
            const isCurrentlyInChat = location.pathname === currentChatPath;

            if (!isCurrentlyInChat) {
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
                  window.location.href = `/#/chat/${notificationData.senderId}`;
                  notification.close();
                };

                // Auto close after 5 seconds
                setTimeout(() => notification.close(), 5000);
              } else {
                console.log('❌ Notification permission not granted');
              }

              // Show in-app Snackbar notification
              setSnackbarMessage(`New message from ${notificationData.senderName}: ${notificationData.message}`);
              setSnackbarSeverity('info');
              setSnackbarOpen(true);
            }

            // Mark notification as read
            const notificationRef = doc(db, 'notifications', change.doc.id);
            setDoc(notificationRef, { read: true }, { merge: true });
          }
        });
      });

      return () => unsubscribe();
    }
  }, [user, location.pathname]); // Add location.pathname to dependencies

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={user ? <MainLayout user={user} theme={theme} /> : <Navigate to="/login" />}>
          <Route index element={<HomePage user={user} />} /> {/* Default route for MainLayout */}
          <Route path="chat/:userId" element={<PrivateChatRoom user={user} />} />
          <Route path="gemini-chat" element={<GeminiChatRoom />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/:userId" element={<Profile />} />
          <Route path="users" element={<UserList />} /> {/* This might be redundant if HomePage already lists users */}
        </Route>
      </Routes>
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = React.useMemo(
    () => createTheme(prefersDarkMode ? darkTheme : lightTheme),
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <AppContent user={user} loading={loading} theme={theme} />
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;

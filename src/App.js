import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, useMediaQuery } from '@mui/material';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, rtdb } from './firebase/config';
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
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <Login />} 
          />
          <Route 
            path="/chat" 
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
      </Router>
    </ThemeProvider>
  );
}

export default App;

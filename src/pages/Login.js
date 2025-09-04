import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config'; // <-- यहाँ ठीक किया गया है

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // ईमेल से एक डिफ़ॉल्ट यूनिक यूज़रनेम बनाएं
        const emailUsername = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const uniqueUsername = `${emailUsername}${randomSuffix}`;

        // Firebase Auth प्रोफ़ाइल का displayName अपडेट करें
        await updateProfile(user, { displayName: uniqueUsername });

        // Firestore में यूज़र डॉक्यूमेंट बनाएं
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: uniqueUsername,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error("Login/Signup Error:", error.code, error.message);
      let userFriendlyError = 'An unknown error occurred. Please try again.';
      switch (error.code) {
        case 'auth/invalid-credential':
          userFriendlyError = 'Incorrect email or password. Please try again.';
          break;
        case 'auth/email-already-in-use':
          userFriendlyError = 'This email is already registered. Please log in.';
          break;
        case 'auth/weak-password':
          userFriendlyError = 'Password must be at least 6 characters long.';
          break;
        case 'auth/invalid-email':
          userFriendlyError = 'Please enter a valid email address.';
          break;
        case 'auth/network-request-failed':
          userFriendlyError = 'Network error. Please check your internet connection.';
          break;
        default:
          userFriendlyError = error.message;
          break;
      }
      setError(userFriendlyError);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" align="center" gutterBottom>
            {isSignUp ? 'Sign Up' : 'Login'}
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              {isSignUp ? 'Sign Up' : 'Login'}
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(''); // Clear error when switching modes
              }}
            >
              {isSignUp ? 'Already have account? Login' : 'Need account? Sign Up'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login;

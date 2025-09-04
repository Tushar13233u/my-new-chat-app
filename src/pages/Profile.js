import React, { useState, useEffect } from 'react';
import { Box, Container, Paper, Typography, TextField, Button, Alert, CircularProgress, Avatar } from '@mui/material';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config'; // <-- यहाँ ठीक किया गया है
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AccountCircle, ArrowBack } from '@mui/icons-material';

function Profile() {
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (currentUser) {
            setUsername(currentUser.displayName || '');
        } else {
            // अगर यूज़र लॉग-इन नहीं है, तो उसे लॉग-इन पेज पर भेजें
            navigate('/login');
        }
    }, [currentUser, navigate]);

    // यह चेक करता है कि नया यूज़रनेम किसी और ने तो नहीं लिया है
    const isUsernameUnique = async (name) => {
        if (name === currentUser.displayName) {
            return true; // यूज़रनेम बदला नहीं गया है
        }
        const q = query(collection(db, "users"), where("displayName", "==", name));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username.trim() || username === currentUser.displayName) {
            setError("Please enter a new username.");
            return;
        }

        setLoading(true);

        try {
            const isUnique = await isUsernameUnique(username);
            if (!isUnique) {
                throw new Error("Username already taken. Please choose another one.");
            }

            // Firebase Auth प्रोफ़ाइल अपडेट करें
            await updateProfile(currentUser, { displayName: username });

            // Firestore में यूज़र डॉक्यूमेंट अपडेट करें
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { displayName: username });

            setSuccess('Profile updated successfully! The change will be fully reflected when you next log in.');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!currentUser) {
        // यह एक फॉलबैक है, useEffect पहले ही रीडायरेक्ट कर देगा।
        return <CircularProgress />;
    }

    return (
        <Container component="main" maxWidth="sm" sx={{ mt: 8 }}>
            <Button component={RouterLink} to="/chat" startIcon={<ArrowBack />} sx={{ mb: 2 }}>
                Back to Chat
            </Button>
            <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'text.primary' }}>
                <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                    <AccountCircle />
                </Avatar>
                <Typography component="h1" variant="h5" sx={{ color: 'text.primary' }}>
                    Profile
                </Typography>
                <Box component="form" onSubmit={handleUpdate} noValidate sx={{ mt: 1 }}>
                    {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2, width: '100%' }}>{success}</Alert>}
                    <TextField
                        margin="normal"
                        fullWidth
                        id="email"
                        label="Email Address"
                        name="email"
                        value={currentUser.email}
                        disabled
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="username"
                        label="Username"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoFocus
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        disabled={loading || !username.trim() || username === currentUser.displayName}
                        sx={{ mt: 3, mb: 2 }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Update Username'}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
}

export default Profile;

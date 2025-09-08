import React, { useState, useEffect } from 'react';
import { Box, Container, Paper, Typography, TextField, Button, Alert, CircularProgress, Avatar } from '@mui/material';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, query, collection, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { AccountCircle, ArrowBack } from '@mui/icons-material';

function Profile() {
    const currentUser = auth.currentUser;
    const navigate = useNavigate();
    const { userId } = useParams(); // Get userId from URL parameters

    const [targetUser, setTargetUser] = useState(null);
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchUserData = async () => {
            if (!currentUser) {
                navigate('/login');
                return;
            }

            const targetUid = userId || currentUser.uid; // Use userId from URL or current user's UID

            try {
                const userDoc = await getDoc(doc(db, 'users', targetUid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setTargetUser({ id: userDoc.id, ...userData });
                    setUsername(userData.displayName || '');
                    setBio(userData.bio || '');
                    setPhotoURL(userData.photoURL || '');
                } else {
                    setError("User not found.");
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
                setError("Failed to load user data.");
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userId, currentUser, navigate]);

    const isCurrentUserProfile = targetUser && currentUser && targetUser.id === currentUser.uid;

    const isUsernameUnique = async (name) => {
        if (name === targetUser.displayName) {
            return true;
        }
        const q = query(collection(db, "users"), where("displayName", "==", name));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username.trim()) {
            setError("Please enter a username.");
            return;
        }

        setLoading(true);

        try {
            const isUnique = await isUsernameUnique(username);
            if (!isUnique) {
                throw new Error("Username already taken. Please choose another one.");
            }

            await updateProfile(currentUser, { displayName: username, photoURL: photoURL });

            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { 
                displayName: username, 
                photoURL: photoURL, 
                bio: bio,
            });

            setSuccess('Profile updated successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Container component="main" maxWidth="sm" sx={{ mt: 8 }}>
                <Alert severity="error">{error}</Alert>
                <Button component={RouterLink} to="/" startIcon={<ArrowBack />} sx={{ mt: 2 }}>
                    Back to Home
                </Button>
            </Container>
        );
    }

    if (!targetUser) {
        return null; // Should not happen if loading and error are handled
    }

    return (
        <Container component="main" maxWidth="sm" sx={{ mt: 8 }}>
            <Button component={RouterLink} to="/" startIcon={<ArrowBack />} sx={{ mb: 2 }}>
                Back to Home
            </Button>
            <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'text.primary' }}>
                <Avatar src={photoURL} sx={{ m: 1, bgcolor: 'secondary.main', width: 100, height: 100 }}>
                    <AccountCircle />
                </Avatar>
                <Typography component="h1" variant="h5" sx={{ color: 'text.primary' }}>
                    {targetUser.displayName || 'User Profile'}
                </Typography>
                <Box component="form" onSubmit={handleUpdate} noValidate sx={{ mt: 1 }}>
                    {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2, width: '100%' }}>{success}</Alert>}
                    {isCurrentUserProfile && (
                        <TextField
                            margin="normal"
                            fullWidth
                            id="email"
                            label="Email Address"
                            name="email"
                            value={targetUser.email}
                            disabled
                        />
                    )}
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
                        disabled={!isCurrentUserProfile}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="photoURL"
                        label="Photo URL"
                        name="photoURL"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                        disabled={!isCurrentUserProfile}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="bio"
                        label="Bio"
                        name="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        multiline
                        rows={3}
                        disabled={!isCurrentUserProfile}
                    />
                    {isCurrentUserProfile && (
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{ mt: 3, mb: 2 }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Update Profile'}
                        </Button>
                    )}
                </Box>
            </Paper>
        </Container>
    );
}

export default Profile;

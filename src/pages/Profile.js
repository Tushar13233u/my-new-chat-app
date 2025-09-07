import React, { useState, useEffect } from 'react';
import { Box, Container, Paper, Typography, TextField, Button, Alert, CircularProgress, Avatar } from '@mui/material';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, query, collection, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AccountCircle, ArrowBack } from '@mui/icons-material';

function Profile() {
    const currentUser = auth.currentUser;
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [nameChangeHistory, setNameChangeHistory] = useState([]);

    useEffect(() => {
        if (currentUser) {
            const fetchUserData = async () => {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUsername(userData.displayName || '');
                    setBio(userData.bio || '');
                    setPhotoURL(userData.photoURL || '');
                    setNameChangeHistory(userData.nameChangeHistory || []);
                }
            };
            fetchUserData();
        } else {
            navigate('/login');
        }
    }, [currentUser, navigate]);

    const isUsernameUnique = async (name) => {
        if (name === currentUser.displayName) {
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

            let updatedNameChangeHistory = [...nameChangeHistory];
            const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            updatedNameChangeHistory = updatedNameChangeHistory.filter(timestamp => timestamp > fourteenDaysAgo);

            if (username !== currentUser.displayName) {
                if (updatedNameChangeHistory.length >= 2) {
                    throw new Error("You can only change your username twice within 14 days.");
                }
                updatedNameChangeHistory.push(Date.now());
            }

            await updateProfile(currentUser, { displayName: username, photoURL: photoURL });

            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, { 
                displayName: username, 
                photoURL: photoURL, 
                bio: bio, 
                nameChangeHistory: updatedNameChangeHistory 
            });

            setNameChangeHistory(updatedNameChangeHistory);
            setSuccess('Profile updated successfully! The change will be fully reflected when you next log in.');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!currentUser) {
        return <CircularProgress />;
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
                    <TextField
                        margin="normal"
                        fullWidth
                        id="photoURL"
                        label="Photo URL"
                        name="photoURL"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
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
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        disabled={loading}
                        sx={{ mt: 3, mb: 2 }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Update Profile'}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
}

export default Profile;

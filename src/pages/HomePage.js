import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Box, Typography, List, ListItem, ListItemText, Avatar, AppBar, Toolbar, IconButton, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';

function HomePage() {
  const [users, setUsers] = useState([]); // all users
  const [currentUserPFP, setCurrentUserPFP] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCurrentUserPFP = async () => {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setCurrentUserPFP(userDocSnap.data().photoURL);
        }
      }
    };

    fetchCurrentUserPFP();
    // Fetch all users
    const q = query(collection(db, 'users'), where('uid', '!=', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersArray = [];
      querySnapshot.forEach((doc) => {
        usersArray.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersArray);
    });
    return () => unsubscribe();
  }, []);

  const handleUserClick = (user) => {
    navigate(`/chat/${user.uid}`);
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      navigate('/login');
    });
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Chats
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/profile')}>
            <Avatar src={currentUserPFP} />
          </IconButton>
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <List>
        {users.map((user) => (
          <ListItem button key={user.id} onClick={() => handleUserClick(user)}>
            <Avatar src={user.photoURL} sx={{ mr: 2 }} />
            <ListItemText primary={user.displayName} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default HomePage;

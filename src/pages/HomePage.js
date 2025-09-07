import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Box, Typography, List, ListItem, ListItemText, Avatar, AppBar, Toolbar, IconButton } from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const [users, setUsers] = useState([]); // all users
  const navigate = useNavigate();

  useEffect(() => {
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
    navigate(`/chat?uid=${user.uid}`);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Chats
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/profile')}>
            <AccountCircle />
          </IconButton>
        </Toolbar>
      </AppBar>
      <List>
        {users.map((user) => (
          <ListItem button key={user.id} onClick={() => handleUserClick(user)}>
            <Avatar sx={{ mr: 2 }}>{user.displayName?.charAt(0).toUpperCase()}</Avatar>
            <ListItemText primary={user.displayName} secondary={user.email} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default HomePage;

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Box, Typography, List, ListItem, ListItemText, Avatar, AppBar, Toolbar, IconButton } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';

function UserList() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
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
          <IconButton component={Link} to="/" color="inherit">
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            New Chat
          </Typography>
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

export default UserList;

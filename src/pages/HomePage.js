import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Box, Typography, List, ListItem, ListItemText, Avatar, AppBar, Toolbar, IconButton, Fab, Badge } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { Logout } from '@mui/icons-material';

import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

function HomePage() {
  const [users, setUsers] = useState([]); // all users
  const [currentUserPFP, setCurrentUserPFP] = useState('');
  const [userStatuses, setUserStatuses] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [lastMessages, setLastMessages] = useState({});
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

  useEffect(() => {
    const unsubscribes = [];
    users.forEach((otherUser) => {
      const statusRef = ref(rtdb, `/status/${otherUser.id}`);
      const unsubscribe = onValue(statusRef, (snapshot) => {
        const status = snapshot.val();
        setUserStatuses((prev) => ({ ...prev, [otherUser.id]: status }));
      });
      unsubscribes.push(unsubscribe);
    });
    return () => unsubscribes.forEach((unsub) => unsub());
  }, [users]);

  useEffect(() => {
    if (!auth.currentUser || users.length === 0) return;

    const unsubscribes = users.map((otherUser) => {
      const chatId = [auth.currentUser.uid, otherUser.id].sort().join('_');
      const messagesRef = collection(db, 'privateMessages', chatId, 'messages');
      const q = query(messagesRef, where('receiverId', '==', auth.currentUser.uid), where('read', '==', false));

      return onSnapshot(q, (snapshot) => {
        setUnreadMessages((prev) => ({ ...prev, [otherUser.id]: snapshot.size }));
      });
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [users, auth.currentUser]);

  useEffect(() => {
    if (!auth.currentUser || users.length === 0) return;

    const unsubscribes = users.map((otherUser) => {
      const chatId = [auth.currentUser.uid, otherUser.id].sort().join('_');
      const messagesRef = collection(db, 'privateMessages', chatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));

      return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const lastMessage = snapshot.docs[0].data();
          setLastMessages((prev) => ({ ...prev, [otherUser.id]: lastMessage }));
        } else {
          setLastMessages((prev) => ({ ...prev, [otherUser.id]: null }));
        }
      });
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [users, auth.currentUser]);

  const handleUserClick = (user) => {
    navigate(`/chat/${user.uid}`);
  };

  const handleViewProfile = (e, userId) => {
    e.stopPropagation(); // Prevent ListItem onClick from firing
    navigate(`/profile/${userId}`);
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      navigate('/login');
    });
  };

  const sortedUsers = [...users].sort((a, b) => {
    const unreadA = unreadMessages[a.id] || 0;
    const unreadB = unreadMessages[b.id] || 0;

    // Prioritize users with unread messages
    if (unreadA > 0 && unreadB === 0) return -1;
    if (unreadA === 0 && unreadB > 0) return 1;

    // Then sort by last message timestamp
    const lastMsgA = lastMessages[a.id];
    const lastMsgB = lastMessages[b.id];

    if (lastMsgA && lastMsgB) {
      return lastMsgB.timestamp.toDate().getTime() - lastMsgA.timestamp.toDate().getTime();
    }
    if (lastMsgA) return -1; // User A has messages, B doesn't
    if (lastMsgB) return 1;  // User B has messages, A doesn't

    return 0; // No unread messages and no last messages, maintain original order
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} sx={{ background: 'transparent', color: 'text.primary', boxShadow: 'none' }}>
        <Toolbar>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Chats
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/profile')}>
            <Avatar src={currentUserPFP} />
          </IconButton>
          <IconButton color="inherit" onClick={handleLogout}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>
      <List sx={{ flexGrow: 1, overflowY: 'auto', px: 2, pt: 1 }}>
        {sortedUsers.map((user) => (
          <ListItem
            button
            key={user.id}
            onClick={() => handleUserClick(user)}
            sx={{
              mb: 1.5,
              borderRadius: 1, // More rectangular
              boxShadow: 2,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' },
              py: 1.5,
              px: 2,
            }}
          >
            <Badge
              badgeContent={unreadMessages[user.id] || 0}
              color="error"
              invisible={unreadMessages[user.id] === 0}
              sx={{ mr: 2 }}
            >
              <Avatar src={user.photoURL} />
            </Badge>
            <ListItemText
              sx={{ minWidth: 0 }}
              primary={
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium', fontFamily: 'Roboto, sans-serif' }}>
                  {user.displayName}
                </Typography>
              }
              secondary={
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: userStatuses[user.id]?.state === 'online' ? 'green' : 'red',
                        display: 'inline-block',
                        mr: 1,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'inline-block', fontFamily: 'Roboto, sans-serif' }}
                    >
                      {userStatuses[user.id]?.state === 'online' ? 'Online' : 'Offline'}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, fontFamily: 'Roboto, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {lastMessages[user.id] ? (
                      <>
                        <strong>
                          {lastMessages[user.id].senderId === auth.currentUser.uid ? 'You: ' : `${users.find(u => u.uid === lastMessages[user.id].senderId)?.displayName || 'User'}: `}
                        </strong>
                        {lastMessages[user.id].text}
                      </>
                    ) : (
                      'No messages yet.'
                    )}
                  </Typography>
                </Box>
              }
            />
            <IconButton edge="end" aria-label="view profile" onClick={(e) => handleViewProfile(e, user.id)}>
              <InfoOutlinedIcon />
            </IconButton>
          </ListItem>
        ))}
      </List>
      <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 24, right: 24 }} onClick={() => navigate('/gemini-chat')}>
        <Typography variant="h5" sx={{ fontWeight: 'bold', fontFamily: 'Roboto, sans-serif' }}>AI</Typography>
      </Fab>
    </Box>
  );
}

export default HomePage;

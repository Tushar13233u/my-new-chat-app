import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Box, Typography, List, ListItem, ListItemText, Avatar, IconButton, Badge, InputBase, Menu, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { Logout, Search, ChatBubbleOutline, MoreVert } from '@mui/icons-material';
import CircleIcon from '@mui/icons-material/Circle'; // For online status dot

import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

function HomePage({ user: currentUser }) { // Renamed prop to avoid conflict with 'user' in map
  const [loading, setLoading] = useState(true);
  
  const [users, setUsers] = useState([]); // all users
  const [currentUserPFP, setCurrentUserPFP] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [userStatuses, setUserStatuses] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // Fetch current user's display name for the sidebar header
  const [currentUserName, setCurrentUserName] = useState('User Name');
  useEffect(() => {
    const fetchCurrentUserName = async () => {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setCurrentUserName(userDocSnap.data().displayName || 'User Name');
        }
      }
    };
    fetchCurrentUserName();
  }, [currentUser]);

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
      setLoading(false); // Set loading to false after users are loaded
    });
    return () => unsubscribe();
  }, [currentUser]); // Added currentUser to dependency array

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

  const filteredAndSortedUsers = [...users]
    .filter(user =>
      (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lastMessages[user.id]?.text || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const unreadA = unreadMessages[a.id] || 0;
      const unreadB = unreadMessages[b.id] || 0;

    // Prioritize users with unread messages
    if (unreadA > 0 && unreadB === 0) return -1;
    if (unreadA === 0 && unreadB > 0) return 1;

    // Then sort by last message timestamp
    const lastMsgA = lastMessages[a.id];
    const lastMsgB = lastMessages[b.id];

    if (lastMsgA && lastMsgB && lastMsgA.timestamp && lastMsgB.timestamp) {
      return lastMsgB.timestamp.toDate().getTime() - lastMsgA.timestamp.toDate().getTime();
    }
    if (lastMsgA && lastMsgA.timestamp) return -1; // User A has messages, B doesn't
    if (lastMsgB && lastMsgB.timestamp) return 1;  // User B has messages, A doesn't

    return 0; // No unread messages and no last messages, maintain original order
  });

  if (loading) {
    return <Typography>Loading...</Typography>; // Simple loading indicator
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      {/* Sidebar Header */}
      <Box className="sidebar-header">
        <Box className="sidebar-header-user-info">
          <Avatar src={currentUserPFP} sx={{ cursor: 'pointer' }} />
          <Typography variant="h6" className="sidebar-header-user-name">
            {currentUserName}
          </Typography>
        </Box>
        <Box className="sidebar-header-icons">
          <IconButton color="inherit">
            <CircleIcon sx={{ fontSize: 10, color: 'green' }} /> {/* Online status dot */}
          </IconButton>
          <IconButton color="inherit">
            <ChatBubbleOutline />
          </IconButton>
          <IconButton color="inherit">
            <MoreVert onClick={(e) => setAnchorEl(e.currentTarget)} />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={() => navigate('/profile')}>Settings</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Search Bar */}
      <Box className="search-bar-container">
        <InputBase
          className="search-input"
          placeholder="Search or start new chat"
          startAdornment={<Search sx={{ color: '#999', mr: 1 }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Box>

      {/* Chat List */}
      <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}> {/* Removed horizontal padding */}
        {filteredAndSortedUsers.map((user) => (
          <ListItem
            button
            key={user.id}
            onClick={() => handleUserClick(user)}
            className="chat-list-item" // Apply custom class
            sx={{
              mb: 0, // Remove bottom margin
              borderRadius: 0, // Remove border radius
              boxShadow: 'none', // Remove box shadow
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)', // Subtle separator
              '&:last-child': { borderBottom: 'none' }, // No border for last item
              py: 1.5,
              px: 2,
            }}
          >
            <Avatar src={user.photoURL} className="chat-list-item-avatar" />
            <ListItemText
              className="chat-list-item-info"
              primary={
                <Box className="chat-list-item-header">
                  <Typography variant="subtitle1" className="chat-list-item-name">
                    {user.displayName}
                  </Typography>
                  <Typography variant="caption" className="chat-list-item-time">
                    {lastMessages[user.id]?.timestamp ? new Date(lastMessages[user.id].timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Typography>
                </Box>
              }
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    className="chat-list-item-message"
                    sx={{ flexGrow: 1 }}
                  >
                    {lastMessages[user.id] ? (
                      <>
                        <strong>
                          {lastMessages[user.id].senderId === auth.currentUser.uid ? 'You: ' : ''}
                        </strong>
                        {lastMessages[user.id].text}
                      </>
                    ) : (
                      'No messages yet.'
                    )}
                  </Typography>
                  {unreadMessages[user.id] > 0 && (
                    <Box className="chat-list-item-badge">
                      {unreadMessages[user.id]}
                    </Box>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
      {/* Removed the FAB button as per new design */}
    </Box>
  );
}

export default HomePage;

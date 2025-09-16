import React, { useState, useEffect, useRef } from 'react';
import { set, onDisconnect } from 'firebase/database';
import {
  Box, Paper, TextField, Button, Typography, AppBar, Toolbar, IconButton,
  Drawer, List, ListItem, ListItemText, Divider, useTheme, useMediaQuery,
  CircularProgress, ListItemIcon, Avatar, Badge, styled, Chip, Menu, MenuItem,
} from '@mui/material';
import {
  Send, People, Logout, AccountCircle, Close, ArrowBack
} from '@mui/icons-material';
import { signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  writeBatch,
  doc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { auth, db, rtdb } from '../firebase/config';
import MessageItem from '../components/MessageItem';

const stringToColor = (string) => {
  let hash = 0;
  for (let i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
};

const stringAvatar = (name) => {
  const safeName = name || '';
  return {
    sx: { bgcolor: stringToColor(safeName) },
    children: `${(safeName.split(' ')[0][0] || '').toUpperCase()}`,
  };
};

const formatDateSeparator = (date) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const groupMessagesByDate = (messages) => {
  if (!messages.length) return [];
  const grouped = [];
  let lastDate = null;
  messages.forEach((msg) => {
    if (msg.timestamp?.toDate) {
      const msgDate = msg.timestamp.toDate();
      if (!lastDate || msgDate.toDateString() !== lastDate.toDateString()) {
        grouped.push({ type: 'date', date: msgDate, id: msgDate.getTime() });
        lastDate = msgDate;
      }
    }
    grouped.push({ type: 'message', ...msg });
  });
  return grouped;
};

const StyledBadge = styled(Badge)(({ theme, status }) => ({
  '& .MuiBadge-badge': {
    backgroundColor: status === 'online' ? '#44b700' : '#9e9e9e',
    color: status === 'online' ? '#44b700' : '#9e9e9e',
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    '&::after': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      content: '""',
    },
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '50%',
  width: '48px',
  height: '48px',
  minWidth: 0,
  background: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  boxShadow: theme.shadows[2],
  transition: 'transform 0.2s',
  '&:hover': {
    background: theme.palette.primary.dark,
    transform: 'scale(1.1)',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '25px',
    background: theme.palette.background.default,
    fontSize: 16,
    fontWeight: 400,
    boxShadow: 'none',
    transition: 'box-shadow 0.2s',
    '&:hover': {
      boxShadow: '0 0 10px rgba(0,0,0,0.2)',
    },
  },
}));

function PrivateChatRoom({ user }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [processedMessages, setProcessedMessages] = useState([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userStatuses, setUserStatuses] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const inputRef = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);

  useEffect(() => {
    if (userId) {
      const userRef = doc(db, 'users', userId);
      getDoc(userRef).then((docSnap) => {
        if (docSnap.exists()) {
          setSelectedUser(docSnap.data());
        } else {
          console.log("No such document!");
          setSelectedUser(null); // Ensure selectedUser is null if not found
        }
      });
    } else {
      setSelectedUser(null); // Clear selected user if userId is not present
    }
  }, [userId]);

  useEffect(() => {
    const grouped = groupMessagesByDate(messages);
    setProcessedMessages(grouped);
  }, [messages]);

  useEffect(() => {
    if (!user || !selectedUser) {
      setOtherTyping(false);
      return;
    }
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const typingRef = ref(rtdb, `/privateTyping/${chatId}/${selectedUser.uid}`);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      setOtherTyping(!!snapshot.val());
    });
    return () => unsubscribe();
  }, [user, selectedUser]);

  useEffect(() => {
    if (!user || !selectedUser) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const myTypingRef = ref(rtdb, `/privateTyping/${chatId}/${user.uid}`);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (newMessage) {
      set(myTypingRef, true);
      onDisconnect(myTypingRef).set(false);
      typingTimeoutRef.current = setTimeout(() => set(myTypingRef, false), 2000);
    } else {
      set(myTypingRef, false);
    }
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (selectedUser) set(myTypingRef, false);
    };
  }, [newMessage, user, selectedUser]);

  useEffect(() => {
    if (!user) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '!=', user.uid));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userList = querySnapshot.docs.map((d) => d.data());
      setUsers(userList);
      setLoadingUsers(false);
      userList.forEach((otherUser) => {
        const statusRef = ref(rtdb, `/status/${otherUser.uid}`);
        onValue(statusRef, (snapshot) => {
          const status = snapshot.val();
          setUserStatuses((prev) => ({ ...prev, [otherUser.uid]: status }));
        });
      });
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedUser) {
      setMessages([]);
      return;
    }
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const messagesRef = collection(db, 'privateMessages', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      const batch = writeBatch(db);
      const unread = querySnapshot.docs.filter(
        (d) => d.data().receiverId === user.uid && !d.data().read,
      );
      if (unread.length > 0) {
        unread.forEach((d) => batch.update(d.ref, { read: true }));
        batch.commit();
      }
    });
    return () => unsubscribe();
  }, [user, selectedUser]);

  useEffect(() => {
    if (!user || users.length === 0) return;
    const unsubscribes = users.map((otherUser) => {
      const chatId = [user.uid, otherUser.uid].sort().join('_');
      const messagesRef = collection(db, 'privateMessages', chatId, 'messages');
      const q = query(messagesRef, where('receiverId', '==', user.uid), where('read', '==', false));
      return onSnapshot(q, (snapshot) => {
        setUnreadMessages((prev) => ({ ...prev, [otherUser.uid]: snapshot.size }));
      });
    });
    return () => unsubscribes.forEach((unsub) => unsub());
  }, [users, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [processedMessages, otherTyping]);

  useEffect(() => {
    if (typeof window.visualViewport !== 'undefined') {
      const handleResize = () => {
        if (inputRef.current) {
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      };
      window.visualViewport.addEventListener('resize', handleResize);
      return () => {
        window.visualViewport.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;
    const tempNewMessage = newMessage;
    setNewMessage('');
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const messagesRef = collection(db, 'privateMessages', chatId, 'messages');
    try {
      const messageData = {
        text: tempNewMessage,
        senderId: user.uid,
        receiverId: selectedUser.uid,
        timestamp: serverTimestamp(),
        read: false,
      };
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          senderId: replyingTo.senderId,
        };
        setReplyingTo(null);
      }
      await addDoc(messagesRef, messageData);

      // Hide keyboard and auto-scroll
      if (inputRef.current) {
        inputRef.current.blur();
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error sending message: ', error);
      setNewMessage(tempNewMessage);
    }
  };

  // Simple notification system
  const sendBrowserNotification = async (receiver, messageText) => {
    try {
      console.log('\ud83d\udd14 Sending notification for:', receiver.displayName);

      // Store notification in Firestore for cross-browser delivery
      const notificationData = {
        receiverId: receiver.uid,
        senderId: user.uid,
        senderName: user.displayName || 'Someone',
        message: messageText,
        timestamp: serverTimestamp(),
        read: false,
        type: 'message',
      };

      await addDoc(collection(db, 'notifications'), notificationData);
      console.log('\u2705 Notification stored in Firestore');

      // Show notification using ServiceWorkerRegistration
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(`\u2705 Message from ${user.displayName || 'Someone'}`, {
          body: messageText,
          icon: '/logo192.png',
          tag: 'message-received',
        });
      } else {
        console.warn('Service worker not available for notifications.');
      }
    } catch (error) {
      console.error('\u274c Error sending notification:', error);
    }
  };

  const deleteMessage = async (message) => {
    if (!selectedUser || !message) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const messageRef = doc(db, 'privateMessages', chatId, 'messages', message.id);
    try {
      await deleteDoc(messageRef);
    } catch (error) {
      console.error('Error deleting message: ', error);
    }
  };

  const handleContextMenu = (event, message) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? { mouseX: event.clientX - 2, mouseY: event.clientY - 4, message }
        : null,
    );
  };

  const handleClose = () => setContextMenu(null);
  const handleDelete = () => {
    if (contextMenu) deleteMessage(contextMenu.message);
    handleClose();
  };
  const handleReply = (message) => {
    setReplyingTo(message);
    handleClose();
  };
  const cancelReply = () => setReplyingTo(null);

  const handleLogout = () => signOut(auth);

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">Chats</Typography>
      </Toolbar>
      <Divider />
      {loadingUsers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress /></Box>
      ) : (
        <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {users.map((otherUser) => (
            <ListItem
              button
              key={otherUser.uid}
              selected={selectedUser?.uid === otherUser.uid}
              onClick={() => {
                navigate(`/chat/${otherUser.uid}`);
                if (isMobile) setDrawerOpen(false);
              }}
            >
              <ListItemIcon>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                  badgeContent={unreadMessages[otherUser.uid] || 0}
                  color="error"
                >
                  <StyledBadge
                    status={userStatuses[otherUser.uid]?.state || 'offline'}
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    variant="dot"
                  >
                    <Avatar src={otherUser.photoURL} {...stringAvatar(otherUser.displayName)} />
                  </StyledBadge>
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography component="span" variant="body1" sx={{ fontWeight: 'bold' }}>
                      {otherUser.displayName || otherUser.email}
                    </Typography>
                    <Typography component="span" variant="caption" sx={{ ml: 1, color: theme.palette.text.secondary }}>
                      ({userStatuses[otherUser.uid]?.state || 'offline'})
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
      <Box>
        <Divider />
        <ListItem button component={RouterLink} to="/profile">
          <ListItemIcon><AccountCircle /></ListItemIcon>
          <ListItemText primary="Profile" />
        </ListItem>
        <ListItem button onClick={handleLogout}>
          <ListItemIcon><Logout /></ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </Box>
    </Box>
  );

  const drawerWidth = 260;

  return (
    <Box sx={{ display: 'flex', height: '100vh', backgroundColor: theme.palette.background.default }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(48, 47, 53, 0.5)' : '#f8fafc',
            borderRight: 'none',
            boxShadow: theme.shadows[2],
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
        <AppBar
          position="static"
          elevation={0}
          sx={{
            background: theme.palette.mode === 'dark' ? 'rgba(48, 47, 53, 0.5)' : 'rgba(255,255,255,0.85)',
            color: theme.palette.text.primary,
            borderRadius: '0 0 18px 18px',
            boxShadow: theme.shadows[2],
            width: '100%',
            mx: 'auto',
          }}
        >
          <Toolbar>
            {isMobile && (
              <IconButton color="inherit" onClick={() => navigate('/')} edge="start" sx={{ mr: 2 }}>
                <ArrowBack />
              </IconButton>
            )}
            {!isMobile && !drawerOpen && (
              <IconButton color="inherit" onClick={() => setDrawerOpen(true)} edge="start" sx={{ mr: 2 }}>
                <People />
              </IconButton>
            )}
            {selectedUser && <Avatar src={selectedUser.photoURL} sx={{ mr: 2, fontWeight: 700, fontSize: 20, boxShadow: 2 }} {...stringAvatar(selectedUser.displayName)} />}
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {selectedUser ? selectedUser.displayName || selectedUser.email : 'Select a user'}
              </Typography>
              {otherTyping && <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>typing...</Typography>}
            </Box>
          </Toolbar>
        </AppBar>

        <Paper elevation={0} sx={{ flexGrow: 1, width: '100%', mx: 'auto', my: 0, p: { xs: 1, sm: 2 }, background: 'transparent', borderRadius: 0, boxShadow: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }} onContextMenu={(e) => e.preventDefault()}>
            {selectedUser ? (
              <>
                {processedMessages.map((item) => {
                  if (item.type === 'date') {
                    return <Box key={item.id} sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><Chip label={formatDateSeparator(item.date)} /></Box>;
                  }
                  const msg = item;
                  return (
                    <MessageItem
                      key={msg.id}
                      msg={msg}
                      user={user}
                      users={users}
                      onContextMenu={handleContextMenu}
                      onReply={handleReply}
                    />
                  );
                })}
              </>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 400 }}>Select a user to start chatting</Typography>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {selectedUser && (
            <Paper elevation={0} sx={{ p: 2, background: theme.palette.background.paper, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}>
              {replyingTo && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, mb: 1, background: theme.palette.background.default, borderRadius: '12px' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Replying to <strong>{users.find(u => u.uid === replyingTo.senderId)?.displayName || 'User'}</strong></Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{replyingTo.text}</Typography>
                  </Box>
                  <IconButton onClick={cancelReply} size="small"><Close /></IconButton>
                </Box>
              )}
              <form onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'center' }}>
                <StyledTextField
                  fullWidth
                  variant="outlined"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  autoComplete="off"
                  inputRef={inputRef}
                />
                <StyledButton
                  type="submit"
                  variant="contained"
                  disabled={!newMessage.trim()}
                >
                  <Send />
                </StyledButton>
              </form>
            </Paper>
          )}
        </Paper>
        <Menu
          open={contextMenu !== null}
          onClose={handleClose}
          anchorReference="anchorPosition"
          anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        >
          <MenuItem onClick={() => handleReply(contextMenu.message)}>Reply</MenuItem>
          {contextMenu?.message?.senderId === user.uid && (
            <MenuItem onClick={handleDelete}>Delete</MenuItem>
          )}
        </Menu>
      </Box>
    </Box>
  );
}

export default PrivateChatRoom;

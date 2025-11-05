import React, { useState, useEffect, useRef } from 'react';
import { set, onDisconnect } from 'firebase/database';
import {
  Box, Paper, TextField, Button, Typography, AppBar, Toolbar, IconButton,
  List, ListItem, ListItemText, Divider, useTheme, useMediaQuery,
  CircularProgress, ListItemIcon, Avatar, Badge, styled, Chip, Menu, MenuItem, InputBase,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import {
  Send, Logout, AccountCircle, Close, ArrowBack, Search, AttachFile, MoreVert, Image
} from '@mui/icons-material';
import CircleIcon from '@mui/icons-material/Circle'; // For online status dot
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
import { debounce } from 'lodash';

const stringToColor = (string) => {
  let hash = 0;
  for (let i = 0;i < string.length; i += 1) {
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


const PrivateChatRoom = React.memo(function PrivateChatRoom({ user }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const debouncedSetNewMessage = React.useCallback(
    debounce(setNewMessage, 200), []
  );

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
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const inputRef = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // Use 'md' breakpoint for consistency with App.js

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

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
        setNewMessage(reader.result); // Set newMessage to the Base64 string
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !selectedUser || !user) return;

    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const messagesRef = collection(db, 'privateMessages', chatId, 'messages');
    try {
      let messageData = {
        senderId: user.uid,
        receiverId: selectedUser.uid,
        timestamp: serverTimestamp(),
        read: false,
      };

      if (newMessage) {
        messageData.text = newMessage;
        setNewMessage('');
      }

      if (selectedImage) {
        messageData.imageUrl = selectedImage;
        setSelectedImage(null);
        setImageFile(null);
      }

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          senderId: replyingTo.senderId,
        };
        setReplyingTo(null);
      }

      await addDoc(messagesRef, messageData);
      if (inputRef.current) {
        inputRef.current.blur();
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      console.error('Error sending message: ', error);
    }
  };

  const deleteMessage = async (message) => {
    if (!selectedUser || !message || !user) return;
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: theme.palette.background.default }}>
      <AppBar position="static" elevation={0} className="chat-room-header">
        <Toolbar sx={{ minHeight: '64px !important' }}>
          {isMobile && (
            <IconButton color="inherit" onClick={() => navigate('/')} edge="start" sx={{ mr: 1 }}>
              <ArrowBack />
            </IconButton>
          )}
          {selectedUser && (
            <StyledBadge
              status={userStatuses[selectedUser.uid]?.state || 'offline'}
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              variant="dot"
              sx={{ mr: 1 }}
            >
              <Avatar src={selectedUser.photoURL} {...stringAvatar(selectedUser.displayName)} />
            </StyledBadge>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" className="chat-room-header-name">
              {selectedUser ? selectedUser.displayName || selectedUser.email : (userId ? 'Loading...' : 'Select a user')}
            </Typography>
            {selectedUser && selectedUser.uid && (
              <Typography variant="caption" className="chat-room-header-status">
                {otherTyping ? 'typing...' : (userStatuses[selectedUser.uid]?.state === 'online' ? 'Online' : 'Offline')}
              </Typography>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box className="message-list-container" onContextMenu={(e) => e.preventDefault()}>
        {selectedUser ? (
          <>
            {processedMessages.map((item) => {
              if (item.type === 'date') {
                return <Box key={item.id} sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><Chip label={formatDateSeparator(item.date)} sx={{ backgroundColor: '#e0e0e0', color: '#333' }} /></Box>;
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
        <Box className="message-input-container">
          {replyingTo && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, mb: 1, backgroundColor: theme.palette.background.paper, borderRadius: '8px', borderLeft: '4px solid #008069', width: '100%', position: 'absolute', bottom: '70px', left: 0, zIndex: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Replying to <strong>{users.find(u => u.uid === replyingTo.senderId)?.displayName || 'User'}</strong></Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{replyingTo.text}</Typography>
              </Box>
              <IconButton onClick={cancelReply} size="small"><Close /></IconButton>
            </Box>
          )}
          
          <InputBase
            className="message-input-field"
            placeholder="Type a message or select an image..."
            value={newMessage}
            onChange={(e) => debouncedSetNewMessage(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') sendMessage(e); }}
            autoComplete="off"
            inputRef={inputRef}
          />
          <IconButton color="inherit" sx={{ mr: 1 }} component="label">
            <Image />
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={handleImageChange}
            />
          </IconButton>
          {selectedImage && (
            <img src={selectedImage} alt="Selected" style={{ maxWidth: '50px', maxHeight: '50px' }} />
          )}
          <IconButton
            type="submit"
            className="message-input-send-button"
            onClick={sendMessage}
            disabled={(!newMessage.trim() && !selectedImage)}
          >
            <Send />
          </IconButton>
        </Box>
      )}
    </Box>
  );
});

export default PrivateChatRoom;

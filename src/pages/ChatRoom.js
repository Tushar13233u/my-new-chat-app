import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, TextField, IconButton, Typography, AppBar, Toolbar, Button, List, Avatar, Chip, Menu, MenuItem, useTheme
} from '@mui/material';
import { Send, Logout, Close } from '@mui/icons-material';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import MessageItem from '../components/MessageItem';

function ChatRoom({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);
  const theme = useTheme();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesArray = [];
      querySnapshot.forEach((doc) => {
        messagesArray.push({ id: doc.id, ...doc.data() });
      });
      setMessages(messagesArray);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    try {
      const messageData = {
        text: newMessage,
        uid: user.uid,
        email: user.email,
        timestamp: serverTimestamp(),
      };

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          text: replyingTo.text,
          email: replyingTo.email,
        };
        setReplyingTo(null);
      }

      await addDoc(collection(db, 'messages'), messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const deleteMessage = async (message) => {
    if (!message) return;
    const messageRef = doc(db, 'messages', message.id);
    try {
      await deleteDoc(messageRef);
    } catch (error) {
      console.error('Error deleting message: ', error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
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

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Chat App
          </Typography>
          <Chip 
            label={user.email} 
            variant="outlined" 
            sx={{ color: 'white', borderColor: 'white', mr: 2 }}
          />
          <Button color="inherit" onClick={handleLogout} startIcon={<Logout />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Paper 
          sx={{ 
            flexGrow: 1, 
            m: 2, 
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <List sx={{ flexGrow: 1, p: 1 }}>
            {messages.map((message) => (
              <MessageItem 
                key={message.id} 
                msg={message} 
                user={user} 
                users={[]} 
                onContextMenu={handleContextMenu} 
                onReply={handleReply} 
              />
            ))}
            <div ref={messagesEndRef} />
          </List>
        </Paper>

        <Paper 
          component="form" 
          onSubmit={sendMessage}
          sx={{ 
            p: 2, 
            m: 2, 
            mt: 0,
          }}
        >
           {replyingTo && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, mb: 1, background: theme.palette.background.default, borderRadius: '12px' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Replying to <strong>{replyingTo.email}</strong></Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{replyingTo.text}</Typography>
                  </Box>
                  <IconButton onClick={cancelReply} size="small"><Close /></IconButton>
                </Box>
              )}
          <Box sx={{display: 'flex', alignItems: 'center'}}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              sx={{ mr: 1 }}
            />
            <IconButton 
              type="submit" 
              color="primary"
              disabled={!newMessage.trim()}
            >
              <Send />
            </IconButton>
          </Box>
        </Paper>
      </Box>
      <Menu
          open={contextMenu !== null}
          onClose={handleClose}
          anchorReference="anchorPosition"
          anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        >
          <MenuItem onClick={() => handleReply(contextMenu.message)}>Reply</MenuItem>
          {contextMenu?.message?.uid === user.uid && (
            <MenuItem onClick={handleDelete}>Delete</MenuItem>
          )}
        </Menu>
    </Box>
  );
}

export default ChatRoom;

import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Paper, TextField, Button, Typography, AppBar, Toolbar, IconButton, Avatar, Chip
} from '@mui/material';
import {
  Send, ArrowBack
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db, auth } from '../firebase/config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';

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

function GeminiChatRoom() {
  const [messages, setMessages] = useState([]);
  const [processedMessages, setProcessedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const navigate = useNavigate();
  const user = auth.currentUser;

  const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

  useEffect(() => {
    if (!user) return;

    const messagesRef = collection(db, 'geminiChats', user.uid, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const grouped = groupMessagesByDate(messages);
    setProcessedMessages(grouped);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [processedMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const userMessage = {
      text: newMessage,
      senderId: user.uid,
      timestamp: serverTimestamp(),
    };

    const messagesRef = collection(db, 'geminiChats', user.uid, 'messages');
    await addDoc(messagesRef, userMessage);

    setNewMessage('');
    setIsLoading(true);
    if (messageInputRef.current) {
      messageInputRef.current.blur();
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
      const result = await model.generateContent(newMessage);
      const response = await result.response;
      const text = response.text();

      const geminiMessage = {
        text: text,
        senderId: 'gemini',
        timestamp: serverTimestamp(),
      };
      await addDoc(messagesRef, geminiMessage);
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      const errorMessage = {
        text: 'Sorry, I am having trouble connecting. Please try again later.',
        senderId: 'gemini',
        timestamp: serverTimestamp(),
      };
      await addDoc(messagesRef, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate(-1)} edge="start" sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AI Chat
          </Typography>
        </Toolbar>
      </AppBar>

      <Paper elevation={0} sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {processedMessages.map((item) => {
          if (item.type === 'date') {
            return <Box key={item.id} sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><Chip label={formatDateSeparator(item.date)} /></Box>;
          }
          const msg = item;
          const isUser = msg.senderId === user?.uid;
          return (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                mb: 2,
              }}
            >
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                  backgroundColor: isUser ? 'primary.main' : 'background.paper',
                  color: isUser ? 'primary.contrastText' : 'text.primary',
                  maxWidth: '80%',
                }}
              >
                <Typography variant="body1">{msg.text}</Typography>
              </Paper>
            </Box>
          );
        })}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper elevation={1} sx={{ p: 2, borderRadius: '20px 20px 20px 5px', backgroundColor: 'background.paper' }}>
              <Typography variant="body1">...</Typography>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <form onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            autoComplete="off"
            inputRef={messageInputRef}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!newMessage.trim() || isLoading}
            sx={{ ml: 2 }}
          >
            <Send />
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default GeminiChatRoom;

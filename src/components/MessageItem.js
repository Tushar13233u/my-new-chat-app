import React, { useState } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { useSwipeable } from 'react-swipeable';
import { useLongPress } from 'use-long-press';
import { Done, DoneAll } from '@mui/icons-material';

const MessageItem = ({ msg, user, users, onContextMenu, onReply }) => {
  const theme = useTheme();
  const [swiped, setSwiped] = useState(false);

  const handlers = useSwipeable({
    onSwipedRight: () => {
      onReply(msg);
      setSwiped(true);
      setTimeout(() => setSwiped(false), 300);
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const longPress = useLongPress((e) => {
    onContextMenu(e, msg);
  });

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: msg.senderId === user.uid ? 'flex-end' : 'flex-start',
        mb: 1.5,
        transition: 'transform 0.2s ease-in-out',
        transform: swiped ? 'translateX(20px) rotate(1deg)' : 'translateX(0) rotate(0deg)',
      }}
      onContextMenu={(e) => onContextMenu(e, msg)}
      {...handlers}
      {...longPress}
    >
      <Paper
        elevation={0}
        sx={{
          p: 1.2,
          px: 2,
          background: msg.senderId === user.uid ? theme.palette.primary.main : theme.palette.secondary.main,
          color: theme.palette.primary.contrastText,
          borderRadius: msg.senderId === user.uid ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          maxWidth: '70%',
          boxShadow: theme.shadows[1],
          fontSize: 16,
          fontWeight: 400,
          transition: 'background 0.2s',
        }}
      >
        {msg.replyTo && (
          <Box sx={{ mb: 1, p: 1, borderLeft: `3px solid ${theme.palette.primary.contrastText}`, opacity: 0.8 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              {users.find(u => u.uid === msg.replyTo.senderId)?.displayName || 'User'}
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{msg.replyTo.text}</Typography>
          </Box>
        )}
        <Typography variant="body1" sx={{ fontWeight: 500, pb: 1 }}>{msg.text}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: theme.palette.primary.contrastText, mr: 0.5 }}>
            {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
          {msg.senderId === user.uid && (msg.read ? <DoneAll fontSize="inherit" sx={{ color: '#4fc3f7' }} /> : <Done fontSize="inherit" />)}
        </Box>
      </Paper>
    </Box>
  );
};

export default MessageItem;

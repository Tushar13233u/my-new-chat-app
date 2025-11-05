import React, { useState } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { useSwipeable } from 'react-swipeable';
import { useLongPress } from 'use-long-press';
import { Done, DoneAll } from '@mui/icons-material';

const MessageItem = ({ msg, user, users, onContextMenu, onReply }) => {
  const [swiped, setSwiped] = useState(false);
  const theme = useTheme(); // Keep theme for other potential uses if needed

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
      className={`message-item ${msg.senderId === user.uid ? 'sent' : 'received'}`}
      onContextMenu={(e) => onContextMenu(e, msg)}
      {...handlers}
      {...longPress}
    >
      <Box
        className={`message-bubble ${msg.senderId === user.uid ? 'sent' : 'received'}`}
      >
        {msg.replyTo && (
          <Box sx={{ mb: 1, p: 1, borderLeft: `3px solid ${msg.senderId === user.uid ? '#008069' : '#666'}`, opacity: 0.8, borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              {users.find(u => u.uid === msg.replyTo.senderId)?.displayName || 'User'}
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{msg.replyTo.text}</Typography>
          </Box>
        )}
        {msg.imageUrl ? ( // If imageUrl exists, display the image
          <img
            src={msg.imageUrl}
            alt="Image"
            style={{ maxWidth: '100%', maxHeight: '200px', cursor: 'pointer' }}
            onClick={() => window.open(msg.imageUrl, '_blank')} // Open image in new tab
          />
        ) : (
          <Typography variant="body1" className="message-bubble-text">{msg.text}</Typography>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" className="message-bubble-time">
            {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
          {msg.senderId === user.uid && (msg.read ? <DoneAll fontSize="inherit" sx={{ color: '#4fc3f7', ml: 0.5 }} /> : <Done fontSize="inherit" sx={{ color: '#999', ml: 0.5 }} />)}
        </Box>
      </Box>
    </Box>
  );
};

export default MessageItem;

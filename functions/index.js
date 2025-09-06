const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendNotification = functions.firestore
  .document('privateMessages/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const { senderId, receiverId, text } = messageData;

    try {
      // Get sender's data
      const senderDoc = await admin.firestore().collection('users').doc(senderId).get();
      const senderData = senderDoc.data();
      const senderName = senderData?.displayName || 'Someone';

      // Get receiver's FCM token
      const receiverDoc = await admin.firestore().collection('users').doc(receiverId).get();
      const receiverData = receiverDoc.data();
      const fcmToken = receiverData?.fcmToken;

      if (!fcmToken) {
        console.log('No FCM token found for receiver:', receiverId);
        return null;
      }

      // Create notification payload
      const payload = {
        notification: {
          title: senderName,
          body: text.length > 50 ? text.substring(0, 50) + '...' : text,
          icon: '/logo192.png',
          badge: '/logo192.png',
          tag: `chat-${senderId}`,
          requireInteraction: false,
        },
        data: {
          chatId: context.params.chatId,
          senderId: senderId,
          senderName: senderName,
          click_action: `${process.env.REACT_APP_URL || 'https://tushar13233u.github.io/my-new-chat-app'}/#/chat?uid=${senderId}`,
        },
        token: fcmToken,
      };

      // Send notification
      const response = await admin.messaging().send(payload);
      console.log('Successfully sent message:', response);
      return response;

    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  });

// Function to clean up old FCM tokens
exports.cleanupTokens = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { token } = data;
  const uid = context.auth.uid;

  try {
    // Remove the token from user's document
    await admin.firestore().collection('users').doc(uid).update({
      fcmToken: admin.firestore.FieldValue.delete()
    });

    return { success: true };
  } catch (error) {
    console.error('Error cleaning up token:', error);
    throw new functions.https.HttpsError('internal', 'Error cleaning up token');
  }
});

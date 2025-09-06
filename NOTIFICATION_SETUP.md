# Firebase Notification Setup Guide

Since Firebase CLI installation is having issues, here's how to set up notifications manually:

## Method 1: Install Firebase CLI (Try these options)

### Option A: Direct Download
1. Download Firebase CLI from: https://firebase.tools/bin/win/instant/latest
2. Extract and add to PATH
3. Run `firebase login`

### Option B: Using Chocolatey (if available)
```powershell
choco install firebase-cli
```

### Option C: Using Scoop (if available)
```powershell
scoop install firebase
```

## Method 2: Manual Firebase Console Setup (Recommended for now)

### Step 1: Get VAPID Key
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `my-chat-9be7c`
3. Go to Project Settings → Cloud Messaging
4. In "Web Push certificates" section, generate/copy VAPID key
5. Replace the dummy key in `src/App.js` line 132

### Step 2: Enable Cloud Functions
1. In Firebase Console → Functions
2. Click "Get Started" if not already enabled
3. Choose your region (preferably us-central1)

### Step 3: Deploy Functions Manually
Since CLI isn't working, you can:

**Option A: Use Firebase Console**
1. Go to Firebase Console → Functions
2. Create a new function
3. Copy the code from `functions/index.js`
4. Deploy manually

**Option B: Use GitHub Actions (Recommended)**
I'll create a GitHub Action workflow for automatic deployment.

## Method 3: Test Without Functions (Temporary)

You can test notifications by:
1. Getting VAPID key (Step 1 above)
2. Using browser's notification API directly
3. Testing with manual FCM token sending

## Current Status
✅ Service Worker configured
✅ Foreground notifications ready
✅ Background notifications ready
❌ Cloud Functions need deployment
❌ VAPID key needs update

## Next Steps
1. Get real VAPID key from Firebase Console
2. Either install Firebase CLI or use manual deployment
3. Test notifications between two browsers

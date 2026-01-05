# Firebase Authentication Setup Guide

## Overview
Firebase Authentication has been integrated into the StreetSafe application. Users must sign in to access the main features.

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

### 2. Enable Authentication Methods

1. In your Firebase project, go to **Authentication** → **Sign-in method**
2. Enable the following sign-in providers:
   - **Email/Password**: Click on it and toggle "Enable"
   - **Google**: Click on it, toggle "Enable", and configure your OAuth settings

### 3. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click on the **Web** icon (</>) to add a web app
4. Register your app with a nickname (e.g., "StreetSafe Web")
5. Copy the Firebase configuration object

### 4. Configure Environment Variables

1. In the `frontend` directory, create a `.env` file (or copy from `.env.example`)
2. Add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Replace the placeholder values with your actual Firebase configuration values.

### 5. Run the Application

```bash
cd frontend
npm install  # Install dependencies (including Firebase)
npm run dev  # Start the development server
```

## Features

### Authentication Pages
- **Login** (`/login`): Email/password and Google sign-in
- **Signup** (`/signup`): Create new account with email/password or Google

### Protected Routes
The following routes require authentication:
- `/` - Home (Map view)
- `/trips` - Trip history
- `/journal` - Safety journal
- `/community` - Community features

### Public Routes
- `/login` - Login page
- `/signup` - Signup page
- `/guardian/:token` - Guardian tracking (no auth required)

### User Interface
- User avatar/name displayed in navbar
- Dropdown menu with user info and sign-out button
- Navbar hidden on login/signup pages

## Security Notes

- **Never commit `.env` file to version control**
- Add `.env` to your `.gitignore` file
- Firebase configuration can be public (it's safe), but keep it in `.env` for easy management
- Use Firebase Security Rules to protect your backend data

## Testing

1. Start the frontend: `npm run dev`
2. Navigate to `http://localhost:3000`
3. You'll be redirected to `/login`
4. Create an account using the signup page
5. After successful authentication, you'll have access to all features

## Troubleshooting

### "Firebase: Error (auth/invalid-api-key)"
- Check that your `VITE_FIREBASE_API_KEY` is correct
- Ensure the `.env` file is in the `frontend` directory
- Restart the dev server after changing `.env`

### "Firebase: Error (auth/unauthorized-domain)"
- Go to Firebase Console → Authentication → Settings → Authorized domains
- Add your domain (e.g., `localhost` for development)

### Google Sign-In Not Working
- Ensure Google sign-in is enabled in Firebase Console
- Configure OAuth consent screen in Google Cloud Console
- Add authorized redirect URIs

## File Structure

```
frontend/src/
├── config/
│   └── firebase.ts              # Firebase configuration
├── contexts/
│   └── AuthContext.tsx          # Authentication context & provider
├── pages/
│   ├── Login.tsx                # Login page
│   └── Signup.tsx               # Signup page
├── components/
│   ├── PrivateRoute.tsx         # Protected route wrapper
│   └── Navbar.tsx               # Updated with user menu
└── App.tsx                      # Updated with AuthProvider & routes
```

## Additional Features You Can Add

1. **Email Verification**: Require users to verify their email
2. **Password Reset**: Add forgot password functionality
3. **Profile Management**: Allow users to update their profile
4. **Social Logins**: Add Facebook, Twitter, etc.
5. **Two-Factor Authentication**: Add extra security layer

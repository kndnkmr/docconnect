// ============================================
// Auth Context - Global Authentication State
// ============================================
// This file manages the "who is logged in?" state for the ENTIRE app.
//
// PROBLEM IT SOLVES:
// Many components need to know: Is the user logged in? What's their name? Role?
// Without Context, you'd have to pass user data through EVERY component as props
// (called "prop drilling" — messy and hard to maintain).
//
// SOLUTION: React Context
// Context is like a "global variable" for React components.
// Wrap your app in a Provider → any component can access the data directly.
//
// KEY CONCEPTS:
// - createContext() = creates the "mailbox" for sharing data
// - Provider = the component that "broadcasts" data to all children
// - useContext() = how a child component "tunes in" to receive the data
// - useState() = stores data that can change (user info, loading state)
// - useEffect() = runs code when the component first loads (check for saved token)

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { disconnectSocket } from '../services/socket';
import { disablePushNotifications } from '../services/push';

// Base API URL — uses environment variable in production, falls back to relative path in development
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Step 1: Create the Context (the "mailbox")
const AuthContext = createContext(null);
// null = default value (no user logged in initially)

// Step 2: Create the Provider component
// This wraps the entire app and provides auth data to all children

export function AuthProvider({ children }) {
  // ---- State: data that changes over time ----

  const [user, setUser] = useState(null);
  // user = the logged-in user's info (null if not logged in)
  // setUser = function to update the user

  const [token, setToken] = useState(localStorage.getItem('token'));
  // token = the JWT token for API requests
  // We check localStorage first — if there's a saved token, the user
  // might still be logged in from a previous session

  const [loading, setLoading] = useState(true);
  // loading = true while we're checking if the user is still logged in
  // We show a loading state instead of briefly flashing the login page

  // ---- Effect: Check if user is already logged in ----
  // useEffect runs ONCE when the component first mounts (loads)
  // It checks: "Is there a saved token? If yes, fetch the user's profile"

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          // Set the token in axios default headers
          // This means EVERY future request will include the token automatically
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Fetch the user's profile from the backend
          const response = await axios.get(`${API_BASE_URL}/auth/me`);
          setUser(response.data.user);
          // If successful, user is now logged in!

        } catch (error) {
          // Token is invalid or expired — clean up
          console.error('Token validation failed:', error.message);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
      // Done checking — stop showing loading state
    };

    loadUser();
  }, [token]);
  // [token] = "re-run this effect if the token changes"

  // ---- Login function ----
  // Called when a user successfully logs in
  // Saves the token and user data

  const login = (newToken, userData) => {
    // Save token to localStorage (persists even if browser is closed)
    localStorage.setItem('token', newToken);
    // localStorage = browser's permanent storage (key-value pairs)
    // Unlike regular variables, this survives page refreshes!

    // Set token in axios headers for future requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    // Update state
    setToken(newToken);
    setUser(userData);
  };

  // ---- Logout function ----
  // Clears all auth data

  const logout = () => {
    // Unsubscribe this browser from push notifications — otherwise a shared
    // device could keep showing a previous user's private notifications
    // (message text, appointment details) after they've logged out and
    // someone else is using it. The unsubscribe request needs the auth
    // token, so we pass the current one explicitly (it resolves async, by
    // which point localStorage's copy is cleared below).
    disablePushNotifications(token);

    // Remove token from storage
    localStorage.removeItem('token');

    // Remove from axios headers
    delete axios.defaults.headers.common['Authorization'];

    // Disconnect the realtime socket so it doesn't keep delivering events
    // for the account that just logged out
    disconnectSocket();

    // Clear state
    setToken(null);
    setUser(null);
  };

  // ---- Value object: what we share with all components ----
  const value = {
    user,       // The logged-in user object (or null)
    token,      // The JWT token (or null)
    loading,    // Whether we're still checking auth status
    login,      // Function to log in
    logout,     // Function to log out
    isAuthenticated: !!user,
    // !! converts to boolean: null → false, {object} → true
    isDoctor: user?.role === 'doctor',
    // user?.role = "if user exists, get their role" (optional chaining)
    // Prevents error when user is null
    isPatient: user?.role === 'patient',
  };

  // ---- Render the Provider ----
  // All children (the entire app) can now access "value" via useAuth()
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Step 3: Create a custom hook for easy access
// Instead of: const { user } = useContext(AuthContext)
// Components do: const { user } = useAuth()
// Cleaner and adds an error check

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
    // This error appears if you forget to wrap your app in <AuthProvider>
  }
  return context;
}

export default AuthContext;

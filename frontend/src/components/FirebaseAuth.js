import React, { useState, useEffect } from 'react';
import { signInWithGoogle, logOut, onAuthStateChange } from '../firebase';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const FirebaseAuth = ({ onAuthChange }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setLoading(true);
      setError(null);

      if (firebaseUser) {
        try {
          // Get Firebase ID token
          const idToken = await firebaseUser.getIdToken();
          
          // Verify with backend
          const response = await axios.post(`${BACKEND_URL}/api/auth/firebase/verify`, {}, {
            headers: { 'Authorization': `Bearer ${idToken}` }
          });

          const userData = response.data.user;
          setUser(userData);
          localStorage.setItem('firebase_token', idToken);
          
          if (onAuthChange) {
            onAuthChange(userData);
          }
        } catch (error) {
          console.error('Error verifying user with backend:', error);
          
          // Handle different types of errors
          if (error.response?.status === 401) {
            setError('Authentication expired. Please sign in again.');
            // Force re-authentication
            await firebaseUser.getIdToken(true); // Force refresh
            localStorage.removeItem('firebase_token');
          } else if (error.response?.status >= 500) {
            setError('Server error. Please try again later.');
          } else if (error.code === 'NETWORK_ERROR' || !error.response) {
            setError('Network error. Please check your connection.');
          } else {
            setError('Failed to verify authentication. Please try again.');
          }
          
          setUser(null);
          localStorage.removeItem('firebase_token');
          
          if (onAuthChange) {
            onAuthChange(null);
          }
        }
      } else {
        setUser(null);
        localStorage.removeItem('firebase_token');
        
        if (onAuthChange) {
          onAuthChange(null);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onAuthChange]);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await signInWithGoogle();
      // The onAuthStateChange listener will handle the rest
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await logOut();
      // The onAuthStateChange listener will handle the rest
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error.message || 'Failed to sign out');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-gray-300">Welcome, {user.username}</span>
        <button
          onClick={handleSignOut}
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded transition-colors"
    >
      Sign In with Google
    </button>
  );
};

export default FirebaseAuth;
import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const GoogleLoginButton: React.FC = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log('User logged in:', user.displayName);
    } catch (error: any) {
      console.error('Error during login:', error.message); // Cast error to 'any' to avoid type errors
    }
  };

  return <button onClick={handleLogin}>Login with Google</button>;
};

export default GoogleLoginButton;

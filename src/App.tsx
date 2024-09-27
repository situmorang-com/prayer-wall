// App.tsx
import React, { useState } from 'react';
import GoogleLoginButton from './components/GoogleLoginButton';
import PrayerForm from './components/PrayerForm';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig'; // Make sure auth is properly imported
import './index.css';
import './styles/App.css'

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);

  // Listen for authentication state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      setUser(user);
    } else {
      setUser(null);
    }
  });

  return (
    <div>
      {/* <h1>Prayer Request Platform</h1> */}
      {!user ? (
        <div>
          <p>Please login to submit a prayer request.</p>
          <GoogleLoginButton />
        </div>
      ) : (
        <div>
          {/* <p>Welcome, {user.displayName}!</p> */}
          <PrayerForm />
        </div>
      )}
    </div>
  );
};

export default App;

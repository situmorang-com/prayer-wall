import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import GoogleLoginButton from './components/GoogleLoginButton';
import PrayerForm from './components/PrayerForm';
import PrayerWall from './components/PrayerWall'; // Import the PrayerWall component
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';
import './index.css';
import './styles/App.css';

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
    <Router>
      <div>
        {!user ? (
          <div>
            <p>Please login to submit a prayer request.</p>
            <GoogleLoginButton />
          </div>
        ) : (
          <div>
            <nav>
              <Link to="/">Prayer Form</Link> | <Link to="/prayer-wall">Prayer Wall</Link>
            </nav>
            <Routes>
              <Route path="/" element={<PrayerForm />} />
              <Route path="/prayer-wall" element={<PrayerWall />} />
            </Routes>
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;

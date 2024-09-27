import React, { useState, useEffect } from 'react';
import { addDoc, collection, getDocs, query, where, updateDoc, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './PrayerForm.css'; // Import the CSS file
import { FaCalendarAlt, FaTrash } from 'react-icons/fa'; // Import calendar and trash icons

const indonesiaRegions = [
  "Jakarta", "Bandung", "Surabaya", "Medan", "Bali", "Makassar",
];

const prayerTypeColors: { [key: string]: string } = {
  healing: '#FFD700', // Gold
  guidance: '#1E90FF', // DodgerBlue
  thanksgiving: '#32CD32', // LimeGreen
  other: '#FF6347', // Tomato
};

const PrayerForm: React.FC = () => {
  const [prayerRequest, setPrayerRequest] = useState('');
  const [prayerType, setPrayerType] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [homeArea, setHomeArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [prayerJournal, setPrayerJournal] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false); // Modal state
  const [editDate, setEditDate] = useState<string | null>(null); // State for editable date answered

  // Handle user authentication and create a new record if user doesn't exist
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnapshot = await getDoc(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setWhatsappNumber(userData?.whatsappNumber || currentUser.phoneNumber || '');
          setHomeArea(userData?.homeArea || '');
        } else {
          // Create new user record in Firestore if user doesn't exist
          await setDoc(userRef, {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            whatsappNumber: currentUser.phoneNumber || '',
            homeArea: '',
          });
        }

        // Load user's previous prayer requests
        const q = query(collection(db, 'prayers'), where('requesterId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        const prayers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as object }));
        setPrayerJournal(prayers);
      } else {
        setUser(null);
        setPrayerJournal([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save user details when phone number or home area changes
  const saveUserDetails = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      try {
        // Update the user document with new phone number and home area
        await updateDoc(userRef, {
          whatsappNumber,
          homeArea,
        });
      } catch (err) {
        console.error('Error updating user details:', err);
      }
    }
  };

  // Log out function
  const handleLogout = async () => {
    await signOut(auth);
    setUser(null); // Reset user state on logout
    setPrayerJournal([]); // Clear prayer journal
  };

  // Handle adding new prayer request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!user) {
      setError('You must be logged in to submit a prayer request.');
      setLoading(false);
      return;
    }

    try {
      const newPrayer = {
        request: prayerRequest,
        prayerType,
        requesterId: user.uid, // Ensure this is set correctly
        timestamp: new Date(),
        prayedForCount: 0,
      };

      // Add the prayer to Firestore
      const docRef = await addDoc(collection(db, 'prayers'), newPrayer);

      // Add the new prayer to the local state immediately
      setPrayerJournal((prevJournal) => [
        { id: docRef.id, ...newPrayer }, // Use the Firestore-generated ID
        ...prevJournal,
      ]);

      setPrayerRequest('');
      setPrayerType('');
      setShowModal(false);
    } catch (err) {
      console.error('Error submitting prayer request:', err);
      setError('Failed to submit the prayer request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mark a prayer as answered and allow editing of the date
  const handleMarkAsAnswered = async (id: string) => {
    try {
      const currentDate = new Date(); // Get the current date
      // Format the date for Firestore
      const formattedDate = {
        seconds: Math.floor(currentDate.getTime() / 1000),
        nanoseconds: 0
      };

      // Update Firestore with the new answeredAt date
      const prayerDoc = doc(db, 'prayers', id);
      await updateDoc(prayerDoc, { answeredAt: formattedDate });

      // Update the local state
      setPrayerJournal(prevJournal =>
        prevJournal.map(prayer =>
          prayer.id === id ? { ...prayer, answeredAt: formattedDate } : prayer
        )
      );
    } catch (err) {
      console.error('Error marking prayer as answered:', err);
    }
  };

  // Handle the answered prayer date update (manually change the date)
  const handleAnsweredPrayerUpdate = async (id: string, answer: string, answeredDate: string) => {
    try {
      const currentPrayer = prayerJournal.find((prayer) => prayer.id === id);
      if (!currentPrayer) {
        console.error("Could not find prayer with ID:", id);
        return;
      }

      const updatedDate = currentPrayer.answeredAt ? 
        new Date(currentPrayer.answeredAt.seconds * 1000) : 
        new Date(); // If no answeredAt, use current date

      const prayerDoc = doc(db, 'prayers', id);
      await updateDoc(prayerDoc, {
        godAnswer: answer,
        answeredAt: {
          seconds: Math.floor(updatedDate.getTime() / 1000),
          nanoseconds: 0
        }
      });

      setPrayerJournal(prevJournal =>
        prevJournal.map(prayer =>
          prayer.id === id ? { ...prayer, godAnswer: answer, answeredAt: currentPrayer.answeredAt } : prayer
        )
      );
    } catch (err) {
      console.error('Error updating answered prayer:', err);
    }
  };

  // Delete a prayer request
  const handleDeletePrayer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'prayers', id));
      setPrayerJournal((prevJournal) => prevJournal.filter((prayer) => prayer.id !== id));
    } catch (err) {
      console.error('Error deleting prayer request:', err);
    }
  };

  return (
    <div className="container">
      {user && (
        <div>
          {/* User info, WhatsApp Number, and Home Area */}
          <div className="user-info">
            <img src={user.photoURL || '/default-avatar.png'} alt="User Profile" className="user-avatar" />
            <input
              type="text"
              value={user.displayName}
              onChange={(e) => setUser({ ...user, displayName: e.target.value })}
              className="input-field"
              placeholder="Name"
            />
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              onBlur={saveUserDetails}
              className="input-field"
              placeholder={user?.phoneNumber ? user.phoneNumber : '+62821xxxxxxx'}
              style={{ color: user?.phoneNumber ? 'black' : 'grey' }}
            />
            <select
              value={homeArea}
              onChange={(e) => setHomeArea(e.target.value)}
              onBlur={saveUserDetails}
              className="input-field"
            >
              <option value="" disabled>Select your home area/city</option>
              {indonesiaRegions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <button onClick={handleLogout} className="btn-logout">
            Log Out
          </button>
        </div>
      )}

      {!user && <p>Please sign in to submit a prayer request.</p>}

      {/* Display Prayer Journal */}
      {user && (
        <div className="prayer-journal">
          <div className="journal-header">
            <h2 className="journal-title">Your Prayer Journal</h2>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              Add New Prayer Request
            </button>
          </div>

          {prayerJournal.map((prayer, index) => (
            <div key={prayer.id || index} className="prayer-card">
              <button onClick={() => handleDeletePrayer(prayer.id)} className="delete-button">
                <FaTrash />
              </button>
              <p><strong>Request:</strong> {prayer.request}</p>
              <p className="prayer-type" style={{ backgroundColor: prayerTypeColors[prayer.prayerType] }}>
                {prayer.prayerType}
              </p>
              <p className="prayer-date-created">
              {prayer.timestamp instanceof Date
                ? prayer.timestamp.toLocaleString()
                : prayer.timestamp && new Date(prayer.timestamp.seconds * 1000).toLocaleString()
              }
              </p>
              <p><strong>Prayed by:</strong> {prayer.prayedForCount} people</p>
              {prayer.answeredAt ? (
                <div className="answered-section mt-4">
                  <div className="answered-top">
                    {/* God's Answer Label and Date on Top */}
                    <div className="answered-info">
                      <label className="answered-label">God's Answer</label>
                      <div className="answered-at">
                        <FaCalendarAlt className="calendar-icon" />
                        <span>{new Date(prayer.answeredAt.seconds * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <textarea
                      className="input-field"
                      placeholder="God's answer"
                      defaultValue={prayer.godAnswer || ''}
                      onBlur={(e) => handleAnsweredPrayerUpdate(prayer.id, e.target.value, editDate || new Date(prayer.answeredAt.seconds * 1000).toISOString())}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleMarkAsAnswered(prayer.id)}
                  className="btn btn-success mt-4"
                >
                  Mark as Answered
                </button>
              )}

            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2 className="modal-title">New Prayer Request</h2>
            <form onSubmit={handleSubmit}>
              <div>
                <label className="modal-label">Prayer Request</label>
                <textarea
                  value={prayerRequest}
                  onChange={(e) => setPrayerRequest(e.target.value)}
                  className="input-field"
                  placeholder="Limit to one prayer request per submission"
                  required
                />
              </div>
              <div>
                <label className="modal-label mt-4">Type of Prayer Request</label>
                <select value={prayerType} onChange={(e) => setPrayerType(e.target.value)} className="input-field" required>
                  <option value="" disabled>Select prayer type</option>
                  <option value="healing">Healing</option>
                  <option value="guidance">Guidance</option>
                  <option value="thanksgiving">Thanksgiving</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
              {error && <p className="error-message">{error}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrayerForm;

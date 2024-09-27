import React, { useState, useEffect } from 'react';
import { addDoc, collection, getDocs, query, where, updateDoc, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './PrayerForm.css'; // Import the CSS file

const indonesiaRegions = [
  "Jakarta", "Bandung", "Surabaya", "Medan", "Bali", "Makassar",
];

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
      await addDoc(collection(db, 'prayers'), {
        request: prayerRequest,
        prayerType,
        requesterId: user.uid,
        timestamp: new Date(),
        prayedForCount: 0,
      });

      setPrayerRequest('');
      setPrayerType('');
      setShowModal(false); // Close the modal after submission

      // Reload prayer journal after submission
      const q = query(collection(db, 'prayers'), where('requesterId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const prayers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as object }));
      setPrayerJournal(prayers);

    } catch (err) {
      console.error('Error submitting prayer request:', err);
      setError('Failed to submit the prayer request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Mark a prayer as answered and allow editing of the date
  const handleMarkAsAnswered = async (id: string) => {
    const currentDate = new Date(); // Get current date immediately in correct format
    const formattedDate = currentDate.toISOString().slice(0, 16); // Format for datetime-local input

    setEditDate(formattedDate); // Allow editing of the date

    // Update the prayer in Firestore
    const prayerDoc = doc(db, 'prayers', id);
    await updateDoc(prayerDoc, {
      answeredAt: currentDate,
    });

    // Update the prayer in the local state immediately
    const updatedPrayers = prayerJournal.map((prayer) =>
      prayer.id === id ? { ...prayer, answeredAt: currentDate } : prayer
    );
    setPrayerJournal(updatedPrayers);
  };

  // Handle the answered prayer date update (manually change the date)
  const handleAnsweredPrayerUpdate = async (id: string, answer: string, answeredDate: string) => {
    const prayerDoc = doc(db, 'prayers', id);
    const updatedDate = new Date(answeredDate); // Convert the selected datetime to a Date object

    await updateDoc(prayerDoc, {
      godAnswer: answer,
      answeredAt: updatedDate,
    });

    const updatedPrayers = prayerJournal.map((prayer) =>
      prayer.id === id ? { ...prayer, godAnswer: answer, answeredAt: updatedDate } : prayer
    );
    setPrayerJournal(updatedPrayers);
  };

  // Delete a prayer request
  const handleDeletePrayer = async (id: string) => {
    await deleteDoc(doc(db, 'prayers', id));
    setPrayerJournal(prayerJournal.filter(prayer => prayer.id !== id));
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
              onBlur={saveUserDetails} // Save phone number on blur
              className="input-field"
              placeholder={user?.phoneNumber ? user.phoneNumber : '+62821xxxxxxx'}
              style={{ color: user?.phoneNumber ? 'black' : 'grey' }}
            />
            <select
              value={homeArea}
              onChange={(e) => setHomeArea(e.target.value)}
              onBlur={saveUserDetails} // Save home area on blur
              className="input-field"
            >
              <option value="" disabled>Select your home area/city</option>
              {indonesiaRegions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          {/* Logout button (small and directly under the picture) */}
          <button onClick={handleLogout} className="btn btn-danger btn-small mb-4">
            Log Out
          </button>

          {/* Button to Open Prayer Request Modal */}
        </div>
      )}

      {!user && (
        <div>
          <p>Please sign in to submit a prayer request.</p>
        </div>
      )}

      {/* Display Prayer Journal */}
      {user && (
        <div className="prayer-journal">
          <div className="journal-header">
            <h2 className="journal-title">Your Prayer Journal</h2>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              Add New Prayer Request
            </button>
          </div>

          {prayerJournal.map((prayer) => (
            <div key={prayer.id} className="prayer-card">
              {/* Delete Button */}
              <button onClick={() => handleDeletePrayer(prayer.id)} className="delete-button">
                X
              </button>
              <p><strong>Request:</strong> {prayer.request}</p>
              <p><strong>Date:</strong> {new Date(prayer.timestamp.seconds * 1000).toLocaleString()}</p>
              <p><strong>Prayed by:</strong> {prayer.prayedForCount} people</p>
              {prayer.answeredAt ? (
                <div className="answered-section mt-4">
                  <label className="answered-label">Date Answered</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={
                      editDate ?? (prayer.answeredAt ? new Date(prayer.answeredAt.seconds * 1000).toISOString().slice(0, 16) : "")
                    } // Check for valid answeredAt field
                    onChange={(e) => setEditDate(e.target.value)} // Handle date changes
                  />
                  <label className="answered-label mt-2">God's Answer</label>
                  <textarea
                    className="input-field"
                    placeholder="God's answer"
                    defaultValue={prayer.godAnswer || ''}
                    onBlur={(e) => handleAnsweredPrayerUpdate(prayer.id, e.target.value, editDate || new Date(prayer.answeredAt.seconds * 1000).toISOString())}
                  />
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

      {/* Prayer Request Modal */}
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

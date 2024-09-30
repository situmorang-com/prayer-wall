import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { addDoc, collection, getDocs, query, where, updateDoc, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Link } from 'react-router-dom';
import './PrayerForm.css'; // Import the CSS file
import { FaTrash } from 'react-icons/fa'; 
import regions from './regions.json'; // Import regions.json

interface CityRegion {
  kota: string[];
  provinsi: string;
}

// Helper function to map English province names to Indonesian province names using regions.json
const getIndonesianProvince = (englishProvince: string) => {
  const matchedRegion = regions.find(region => 
    region.province.toLowerCase() === englishProvince.toLowerCase()
  );
  return matchedRegion ? matchedRegion.provinsi : englishProvince; // Return Indonesian name if found, else return the original
};

// Define popular cities as a fallback
const popularCities: CityRegion[] = [
  { kota: ['Jakarta'], provinsi: 'DKI Jakarta' },
  { kota: ['Surabaya'], provinsi: 'Jawa Timur' },
  { kota: ['Bandung'], provinsi: 'Jawa Barat' },
  { kota: ['Medan'], provinsi: 'Sumatera Utara' },
  { kota: ['Bali'], provinsi: 'Bali' },
];

const prayerTypeColors: { [key: string]: string } = {
  healing: '#FFD700', // Gold
  guidance: '#1E90FF', // DodgerBlue
  thanksgiving: '#32CD32', // LimeGreen
  other: '#FF6347', // Tomato
};

const formatDate = (dateInput: any) => {
  if (!dateInput) {
    return 'yyyy-mm-dd'; // Fallback if dateInput is invalid
  }

  if (dateInput instanceof Date) {
    return dateInput.toISOString().slice(0, 10); // Format JS Date objects
  }

  if (dateInput.seconds) {
    const date = new Date(dateInput.seconds * 1000); // Convert Firestore Timestamp to JS Date
    return date.toISOString().slice(0, 10); // Format the date as YYYY-MM-DD
  }

  return 'yyyy-mm-dd'; // Fallback if the date is not valid
};

// Validate Firestore dateCreated or Date fields before formatting
const safeFormatDate = (dateInput: any) => {
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput.toISOString().slice(0, 10); // Format as YYYY-MM-DD if valid
  }
  return ''; // Return empty if invalid or null
};

const PrayerForm: React.FC = () => {
  const [prayerRequest, setPrayerRequest] = useState('');
  const [prayerType, setPrayerType] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [googleUserName, setGoogleUserName] = useState(''); // Store original Google username
  const [googlePhone, setGooglePhone] = useState(''); // Store original Google phone number
  const [userLocation, setUserLocation] = useState(''); 
  const [detectedLocation, setDetectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [prayerJournal, setPrayerJournal] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false); // Modal state
  const [editDate, setEditDate] = useState<string | null>(null); // State for editable date answered

  // Handle user authentication and create a new record if user doesn't exist
  useEffect(() => {
// Add userLocation as a dependency
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        const userRef = doc(db, 'users', currentUser.uid);
        const userSnapshot = await getDoc(userRef);
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setDisplayName(userData?.displayName || (currentUser.displayName ?? '')); // Added parentheses
          setWhatsappNumber(userData?.whatsappNumber || (currentUser.phoneNumber ?? '')); // Added parentheses
  
          // Set original Google details (ensure these are only set once, when first logging in)
          setGoogleUserName(userData?.googleUserName || (currentUser.displayName ?? '')); // Added parentheses
          setGooglePhone(userData?.googlePhone || (currentUser.phoneNumber ?? '')); // Added parentheses
  
          setUserLocation(userData?.userLocation || '');
          setDetectedLocation(userData?.detectedLocation || ''); // Set detected location from Firestore
        } else {
          // Create new user record in Firestore if user doesn't exist, with the original Google details
          await setDoc(userRef, {
            googleUserName: currentUser.displayName ?? '', // Save original Google username or empty string
            googlePhone: currentUser.phoneNumber ?? '', // Save original Google phone number or empty string
            displayName: currentUser.displayName ?? '', // Initially set displayName to Google name
            whatsappNumber: currentUser.phoneNumber ?? '', // Initially set whatsappNumber to Google phone number
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            userLocation: '',
            detectedLocation: ''
          });
          setGoogleUserName(currentUser.displayName ?? ''); // Store in state, use empty string if null
          setGooglePhone(currentUser.phoneNumber ?? ''); // Store in state, use empty string if null
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

    // Detect location when the component loads
    detectLocation();

    return () => unsubscribe();
  }, []);

  // Detect user location via Geolocation API
  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const locationData = await response.json();
  
          if (locationData && locationData.address) {
            const city = locationData.address.city || locationData.address.town || locationData.address.state_district || locationData.address.village;
            const englishProvince = locationData.address.state || locationData.address.region || locationData.address.county; // Try to extract province/state/region information

          // Map English province name to Indonesian province name
          const indonesianProvince = getIndonesianProvince(englishProvince);

          const detectedLocationValue = `${city}, ${indonesianProvince}`;
          setDetectedLocation(detectedLocationValue); // Set detected location in the state

        // Check if the user is authenticated before saving the detected location
          if (user) {
            try {
              const userRef = doc(db, 'users', user.uid);
              // Update Firestore with the detected location
              await updateDoc(userRef, { detectedLocation: detectedLocationValue });
            } catch (err) {
              console.error("Error updating detected location in Firestore:", err);
            }
          }

          
           // Match both city and province in regions.json for accurate detection
           const matchedRegion = regions.find(region => city.toLowerCase().includes(region.kota[0].toLowerCase()));
           if (matchedRegion) {
             setUserLocation(`${matchedRegion.kota[0]}, ${matchedRegion.provinsi}`); // Automatically select if matched with known region
           }
          }
        } catch (error) {
          console.error("Error fetching location data:", error);
          setError('Unable to detect location. Please select your area manually.');
        }
      }, (error) => {
        console.error("Error getting location:", error);
        setError('Unable to detect location. Please select your area manually.');
        // setUserLocation('Jakarta, DKI Jakarta');
      });
    } else {
      setError('Geolocation is not supported by your browser.');
      // setUserLocation('Jakarta, DKI Jakarta');
    }
  };

  // Save user details when phone number or location changes
  const saveUserDetails = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      try {
        // Update the user document with new phone number and locations
        await updateDoc(userRef, {
          displayName, // Edited name
          whatsappNumber, // Edited phone number
          userLocation, 
          detectedLocation, // Added detectedLocation to Firestore
        });
      } catch (err) {
        console.error('Error updating user details:', err);
      }
    }
  };

    // UseEffect to trigger saving the detectedLocation
    useEffect(() => {
      if (detectedLocation && user) {
        saveUserDetails(); // Save immediately after detecting the location
      }
    }, [detectedLocation, user]); // Listen for changes in detectedLocation and user

const sortCities = (cityData: CityRegion[]) => {
  return cityData.sort((a: CityRegion, b: CityRegion) => a.kota[0].localeCompare(b.kota[0]));
};

// Generate city options for dropdown
const generateCityOptions = () => {
  let options = [];

  // If a detected location is available, add it to the top of the dropdown and prioritize nearby cities
  if (detectedLocation) {
    options.push({
      value: detectedLocation,
      label: `📍 ${detectedLocation} (Detected)`
    });

    // Extract the city name and province from the detected location
    const [detectedCity, detectedProvince] = detectedLocation.split(',').map(str => str.trim());

    // Convert the English province to Indonesian using the helper function
    const indonesianProvince = getIndonesianProvince(detectedProvince);

    // Filter nearby cities based on the detected location's city name and province
    const nearbyCities = regions.filter((region: CityRegion) =>
      region.provinsi.toLowerCase() === indonesianProvince.toLowerCase()
    );

    // Only add nearby cities if they're different from the detected location
    if (nearbyCities.length > 0) {
      options.push(
        ...nearbyCities.flatMap((city: CityRegion) =>
          city.kota.map((kotaName: string) => ({
            value: `${kotaName}, ${city.provinsi}`,
            label: `${kotaName}, ${city.provinsi}`
          }))
        ),
        { label: '––––', value: '', isDisabled: true }
      );
    } else {
      options.push({ label: '––––', value: '', isDisabled: true });
    }
  } else {
    // If no location detected, load popular cities first
    options.push(
      ...popularCities.map((city: CityRegion) => ({
        value: `${city.kota[0]}, ${city.provinsi}`,
        label: `${city.kota[0]}, ${city.provinsi}`
      })),
      { label: '––––', value: '', isDisabled: true }
    );
  }

  // Add the rest of the cities in alphabetical order
  const sortedCities = sortCities(regions);
  options.push(
    ...sortedCities.flatMap((city: CityRegion) =>
      city.kota.map((kotaName: string) => ({
        value: `${kotaName}, ${city.provinsi}`,
        label: `${kotaName}, ${city.provinsi}`
      }))
    )
  );

  return options;
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
    const currentDate = new Date(); // Use current date as a Date object

      const newPrayer = {
        request: prayerRequest,
        prayerType,
        requesterId: user.uid, // Ensure this is set correctly
      dateCreated: currentDate, // Store Date object directly
        prayedForCount: 0,
        dateAnswered: null
      };

      // Add the prayer to Firestore
      const docRef = await addDoc(collection(db, 'prayers'), newPrayer);

      // Add the new prayer to the local state immediately
      setPrayerJournal((prevJournal) => [
      { id: docRef.id, ...newPrayer }, // Ensure dateCreated is stored as a Date object
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
      const currentDate = new Date(); // Get the current date and time

    // Update Firestore with the new dateAnswered as a Date object
      const prayerDoc = doc(db, 'prayers', id);
      await updateDoc(prayerDoc, {
      dateAnswered: currentDate // Save Date object
      });
  
      // Update the local state
      setPrayerJournal(prevJournal =>
        prevJournal.map(prayer =>
          prayer.id === id ? { ...prayer, dateAnswered: currentDate } : prayer
        )
      );
    } catch (err) {
      console.error('Error marking prayer as answered:', err);
    }
  };

  // Handle the answered prayer date update (manually change the date)
  const handleAnsweredPrayerUpdate = async (id: string, answer: string, answeredDate: string) => {
    try {
      const updatedDate = answeredDate ? new Date(answeredDate) : new Date(); // Convert the string to a JavaScript Date

      const prayerDoc = doc(db, 'prayers', id);
      await updateDoc(prayerDoc, {
        godAnswer: answer,
        dateAnswered: updatedDate // Store JavaScript Date in Firestore
      });

      setPrayerJournal(prevJournal =>
        prevJournal.map(prayer =>
          prayer.id === id ? { ...prayer, godAnswer: answer, dateAnswered: updatedDate } : prayer
        )
      );
    } catch (err) {
      console.error('Error updating answered prayer:', err);
    }
  };

  // Handle date changes for prayer creation and answered date
  const handleDateChange = async (id: string, field: string, newDate: string) => {
    if (!newDate) return; // Prevent empty date

    const updatedDate = new Date(newDate);
    if (isNaN(updatedDate.getTime())) {
      console.error('Invalid date:', newDate);
      return; // Exit early on invalid date
    }

    const formattedDate = {
      seconds: Math.floor(updatedDate.getTime() / 1000),
      nanoseconds: 0
    };

    const prayerDoc = doc(db, 'prayers', id);
    await updateDoc(prayerDoc, { [field]: formattedDate });

    setPrayerJournal(prevJournal =>
      prevJournal.map(prayer =>
        prayer.id === id ? { ...prayer, [field]: formattedDate } : prayer
      )
    );
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
          {/* User info, WhatsApp Number, and User Location */}
          <div className="user-info">
            <img src={user.photoURL || '/default-avatar.png'} alt="User Profile" className="user-avatar" />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => saveUserDetails()} // Call saveUserDetails directly
              className="input-field"
              placeholder="Name"
            />
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              onBlur={() => saveUserDetails()} // Call saveUserDetails directly
              className="input-field"
              placeholder={user?.phoneNumber ? user.phoneNumber : '+62821xxxxxxx'}
              // style={{ color: user?.phoneNumber ? 'black' : 'grey' }}
            />
            <Select
              options={generateCityOptions()}
              value={userLocation ? { value: userLocation, label: userLocation } : null}
              onChange={(option: any) => {
                setUserLocation(option?.value); // Update the state with the selected location
                // saveUserDetailsImmediate(option?.value); // Trigger Firestore update immediately with the new location
    // saveUserDetails(); // Call the function to save the updated location to Firestore
              }}
              onBlur={() => saveUserDetails()} // Save user details when dropdown loses focus
              placeholder="Select your location"
              isSearchable
              className="input-field"
            />
            
          </div>
          {/* Detected location displayed below */}
          {detectedLocation && (
            <div className="detected-location" style={{ fontSize: 'small', color: '#555', textAlign: 'right', marginTop: '5px' }}>
              <span role="img" aria-label="location" style={{ marginRight: '5px' }}>📍</span>
              {detectedLocation}
            </div>
          )}
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
            <div className="journal-buttons">
              <Link to="/prayer-wall" className="btn btn-primary">
                Go to Prayer Wall
              </Link>
              <button onClick={() => setShowModal(true)} className="btn btn-primary">
                Add New Prayer Request
              </button>
            </div>
          </div>

          {prayerJournal.map((prayer, index) => (
            <div key={prayer.id || index} className="prayer-card">
              <button onClick={() => handleDeletePrayer(prayer.id)} className="delete-button">
                <FaTrash />
              </button>
              <div className="prayer-content">
                <p><strong>Request:</strong> {prayer.request}</p>
                <p className="prayer-type" style={{ backgroundColor: prayerTypeColors[prayer.prayerType] }}>
                  {prayer.prayerType}
                </p>

                {prayer.dateAnswered ? (
                <div className="answered-section mt-4">
                  <div className="answered-top">
                    {/* God's Answer Label and Date on Top */}
                    <div className="answered-info">
                      <label className="answered-label">God's Answer</label>
                      <input
                        type="date"
                        id="answered-date"
                        className="input-field date"
                        value={formatDate(prayer.dateAnswered)} // Use formatDate for dateAnswered field
                        onChange={(e) => handleDateChange(prayer.id, 'dateAnswered', e.target.value)}
                        style={{ fontSize: 'small', width: '130px', border: 'none' }}
                      />

                    </div>
                    <textarea
                      className="input-field"
                      placeholder="God's answer"
                      defaultValue={prayer.godAnswer || ''}
                      onBlur={(e) => handleAnsweredPrayerUpdate(prayer.id, e.target.value, editDate || new Date().toISOString())}
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

                {/* Candle Animation */}
                <div className="candle-container">
                <span className="prayed-count">{prayer.prayedForCount}</span>
                  <div className={`candle ${prayer.prayedForCount > 0 ? 'flame-active' : 'smoke-active'}`}>
                    <div className="thread"></div>
                    <div className={`flame ${prayer.prayedForCount > 0 ? 'active' : ''}`}></div>
                    <div className={`glow ${prayer.prayedForCount > 0 ? 'active' : ''}`}></div>
                    {prayer.prayedForCount > 0 && <div className="blinking-glow"></div>} {/* Conditionally render blinking-glow */}
                  </div>
                </div>

              
              
              <p className="prayer-date-created">
                <input
                  type="date"
                  id="prayer-date"
                  className="input-field date"
                  value={formatDate(prayer.dateCreated)} // Use formatDate to display dateCreated
                  onChange={(e) => handleDateChange(prayer.id, "dateCreated", e.target.value)}
                  style={{ fontSize: 'small', width: '130px', border: 'none' }}
                />
              </p>



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

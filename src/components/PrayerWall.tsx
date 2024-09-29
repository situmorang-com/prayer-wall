import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import './PrayerWall.css'; // Import the CSS file

const PrayerWall: React.FC = () => {
  const [prayerRequests, setPrayerRequests] = useState<any[]>([]);

  useEffect(() => {
    const fetchPrayerRequests = async () => {
      const querySnapshot = await getDocs(collection(db, 'prayers'));
      const prayers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPrayerRequests(prayers);
    };

    fetchPrayerRequests();
  }, []);

  const handlePrayedFor = async (id: string, currentCount: number) => {
    const prayerDoc = doc(db, 'prayers', id);
    await updateDoc(prayerDoc, { prayedForCount: currentCount + 1 });
    const updatedPrayers = prayerRequests.map(prayer => 
      prayer.id === id ? { ...prayer, prayedForCount: currentCount + 1 } : prayer
    );
    setPrayerRequests(updatedPrayers);
  };

  return (
    <div className="prayer-wall-container">
      <h2 className="prayer-wall-title">Prayer Wall</h2>
      <div className="prayer-wall-grid">
        {prayerRequests.map((prayer) => (
          <div key={prayer.id} className="prayer-card">
            <h3 className="prayer-request-text">{prayer.request}</h3>
            <p className="prayer-requester">Requested by: {prayer.requesterName || 'Anonymous'}</p>
            <p className="prayer-prayed-for">
              Prayed by: {prayer.prayedForCount} {prayer.prayedForCount === 1 ? 'person' : 'people'}
            </p>
            <button className="btn-prayed-for" onClick={() => handlePrayedFor(prayer.id, prayer.prayedForCount)}>
              I've Prayed for This
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrayerWall;

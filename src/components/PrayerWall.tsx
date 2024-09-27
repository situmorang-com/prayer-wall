import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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
    <div>
      <h2>Prayer Wall</h2>
      {prayerRequests.map((prayer) => (
        <div key={prayer.id}>
          <p>{prayer.request}</p>
          <p>Requested by: {prayer.requesterName}</p>
          <p>Prayed by: {prayer.prayedForCount} people</p>
          <button onClick={() => handlePrayedFor(prayer.id, prayer.prayedForCount)}>
            I've Prayed for This
          </button>
        </div>
      ))}
    </div>
  );
};

export default PrayerWall;

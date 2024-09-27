import React from 'react';

interface PrayerRequestProps {
  prayer: {
    id: number;
    name: string;
    request: string;
    likes: number;
    prayedFor: number;
  };
  onLike: (id: number) => void;
  onPrayFor: (id: number) => void;
}

const PrayerRequest: React.FC<PrayerRequestProps> = ({ prayer, onLike, onPrayFor }) => {
  return (
    <div className="prayer-request">
      <h3>{prayer.name}</h3>
      <p>{prayer.request}</p>
      <div>
        <button onClick={() => onLike(prayer.id)}>Like ({prayer.likes})</button>
        <button onClick={() => onPrayFor(prayer.id)}>Pray for this ({prayer.prayedFor})</button>
      </div>
    </div>
  );
};

export default PrayerRequest;

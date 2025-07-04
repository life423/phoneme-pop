import React from 'react';
import { Star } from 'lucide-react';

const CelebrationOverlay = ({ showCelebration }) => {
  if (!showCelebration || process.env.REACT_APP_ENABLE_CELEBRATIONS !== 'true') return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="text-4xl sm:text-5xl md:text-6xl animate-bounce">
        🎉
      </div>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className="absolute text-yellow-400 animate-pulse"
          style={{
            top: `${20 + i * 15}%`,
            left: `${10 + i * 20}%`,
            animationDelay: `${i * 0.1}s`
          }}
          size={window.innerWidth < 640 ? 20 : 30}
        />
      ))}
    </div>
  );
};

export default CelebrationOverlay;
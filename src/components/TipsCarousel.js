import React, { useState, useEffect } from 'react';
import { EDUCATIONAL_TIPS } from '../data/educationalTips';

const TipsCarousel = () => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    if (process.env.REACT_APP_ENABLE_TIPS_CAROUSEL === 'true') {
      const interval = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % EDUCATIONAL_TIPS.length);
      }, parseInt(process.env.REACT_APP_TIP_ROTATION_INTERVAL) || 5000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div className="w-full max-w-sm px-4">
      <div className="bg-white/80 backdrop-blur rounded-lg p-3 sm:p-4 shadow-md">
        <div className="flex items-center justify-center gap-2">
          <div 
            key={currentTipIndex}
            className={`text-xs sm:text-sm text-center transition-all duration-500 ${
            EDUCATIONAL_TIPS[currentTipIndex]?.type === 'phonics' ? 'text-blue-700' :
            EDUCATIONAL_TIPS[currentTipIndex]?.type === 'encouragement' ? 'text-green-700' :
            EDUCATIONAL_TIPS[currentTipIndex]?.type === 'strategy' ? 'text-purple-700' :
            'text-gray-700'
          }`}>
            {EDUCATIONAL_TIPS[currentTipIndex]?.text || ''}
          </div>
        </div>
        <div className="flex justify-center gap-1 mt-2">
          {EDUCATIONAL_TIPS.map((_, index) => (
            <div
              key={index}
              className={`h-1 w-1 rounded-full transition-all duration-300 ${
                index === currentTipIndex 
                  ? 'bg-purple-500 w-3' 
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TipsCarousel;
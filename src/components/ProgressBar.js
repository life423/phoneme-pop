import React from 'react';
import { wordLists } from '../data/wordLists';

const ProgressBar = ({ level, attemptedWords }) => {
  return (
    <div className="bg-white border-t p-1.5 sm:p-3 md:p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
          Level {level} Progress: {attemptedWords.size} / {wordLists[level].length} words
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 md:h-3">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${(attemptedWords.size / wordLists[level].length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
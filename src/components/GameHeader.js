import React from 'react';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';

const GameHeader = ({ 
  showInstructions, 
  setShowInstructions, 
  level, 
  score, 
  streak 
}) => {
  return (
    <div className="bg-white shadow-md p-2 sm:p-4">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-purple-700">Phoneme Pop!</h1>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="p-1 sm:p-2 rounded-full hover:bg-purple-100 transition-colors"
            aria-label="Toggle instructions"
          >
            {showInstructions ? (
              <ChevronUp className="text-purple-600" size={window.innerWidth < 640 ? 20 : 24} />
            ) : (
              <ChevronDown className="text-purple-600" size={window.innerWidth < 640 ? 20 : 24} />
            )}
          </button>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
          <div className="text-center">
            <div className="text-xs sm:text-sm text-gray-600">Level</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-700">{level}</div>
          </div>
          <div className="text-center">
            <div className="text-xs sm:text-sm text-gray-600">Score</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs sm:text-sm text-gray-600">Streak</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600 flex items-center gap-1">
              {streak}
              {streak >= 3 && <Trophy size={window.innerWidth < 640 ? 16 : 20} className="text-orange-500" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameHeader;
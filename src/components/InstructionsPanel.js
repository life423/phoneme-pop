import React from 'react';
import { ChevronUp } from 'lucide-react';

const InstructionsPanel = ({ showInstructions, setShowInstructions }) => {
  if (!showInstructions) return null;

  return (
    <div className="bg-blue-100 border-b-2 border-blue-200 p-2 sm:p-4 max-h-[25vh] sm:max-h-none overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-1 sm:mb-2">
          <h2 className="font-bold text-blue-800 text-sm sm:text-base">How to Play:</h2>
          <button
            onClick={() => setShowInstructions(false)}
            className="sm:hidden p-1 hover:bg-blue-200 rounded"
            aria-label="Close instructions"
          >
            <ChevronUp size={16} />
          </button>
        </div>
        <ol className="list-decimal list-inside text-blue-700 space-y-0.5 sm:space-y-1 text-xs sm:text-sm mb-1 sm:mb-4">
          <li>Click the big word bubble to break it into sound bubbles</li>
          <li><strong>Click each sound bubble IN ORDER from left to right</strong> to rebuild the word</li>
          <li>Each sound has a special symbol to help you remember it</li>
          <li>Press the speaker button to hear any sound again</li>
          <li>Get points for each correct word - harder levels give more points!</li>
        </ol>
        <p className="text-blue-600 font-semibold text-xs sm:text-sm mb-1 sm:mb-4">
          Remember: The order matters! 'cat' is not the same as 'tac'!
        </p>
        
        {/* Diacritical Marks Guide - Hidden on very small screens */}
        <div className="hidden sm:block bg-white rounded-lg p-2 sm:p-3 mt-2">
          <h3 className="font-bold text-blue-800 mb-2 text-sm">Reading Helper Marks:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl md:text-2xl font-bold">ă</span>
              <span>= short a (căt)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl md:text-2xl font-bold">ā</span>
              <span>= long a (cāke)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl md:text-2xl font-bold">sh̲</span>
              <span>= one sound</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPanel;
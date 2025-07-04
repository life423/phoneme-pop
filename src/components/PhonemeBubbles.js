import React from 'react';
import { X } from 'lucide-react';
import { phonemeSymbols } from '../data/phonemeSymbols';
import { pronounceWord } from '../utils/speechUtils';

const PhonemeBubbles = ({ 
  phonemes, 
  selectedPhonemes, 
  onPhonemeClick, 
  onCheckWord, 
  showError 
}) => {
  const getPhonemeVisual = (phoneme) => {
    return phonemeSymbols[phoneme] || { symbol: '', hint: phoneme, color: 'gray' };
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="mb-2 sm:mb-4 md:mb-6 text-purple-600 font-semibold text-sm sm:text-base md:text-lg animate-pulse text-center">
        ✨ Put the sounds back in order! ✨
      </div>
      
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:gap-6 lg:gap-8 max-w-full px-2">
        {phonemes.map((phoneme, displayIndex) => {
          const isSelected = selectedPhonemes.some(p => p.id === phoneme.id);
          const visual = getPhonemeVisual(phoneme.sound);
          
          return (
            <button
              key={phoneme.id}
              onClick={() => {
                onPhonemeClick(phoneme);
                pronounceWord(phoneme.sound);
              }}
              className={`transform transition-all duration-300 ${
                isSelected ? 'scale-105 sm:scale-110' : 'hover:scale-105'
              } flex flex-col items-center`}
            >
              <div className="text-lg sm:text-2xl md:text-3xl mb-0.5 sm:mb-1 text-center animate-bounce" style={{ animationDelay: `${displayIndex * 0.1}s` }}>
                {visual.symbol}
              </div>
              
              <div className={`relative ${
                isSelected 
                  ? 'bg-gradient-to-br from-green-400 to-green-600 ring-2 sm:ring-4 ring-green-300' 
                  : 'bg-gradient-to-br from-blue-400 to-cyan-500'
              } text-white text-lg sm:text-2xl md:text-3xl font-bold px-3 sm:px-6 md:px-8 py-2 sm:py-4 md:py-6 rounded-full shadow-xl`}>
                {phoneme.sound}
              </div>
              
              <div className="hidden sm:block text-xs text-gray-600 mt-1 text-center font-medium">
                {visual.hint}
              </div>
              
              <div className={`absolute inset-0 ${
                isSelected ? 'bg-green-400' : 'bg-blue-400'
              } rounded-full blur-lg opacity-30 pointer-events-none`} />
            </button>
          );
        })}
      </div>
      
      {selectedPhonemes.length > 0 && (
        <div className="mt-3 sm:mt-6 md:mt-8 px-2 w-full max-w-lg">
          <div className={`bg-white rounded-lg shadow-lg p-2 sm:p-3 md:p-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 ${
            showError ? 'ring-2 sm:ring-4 ring-red-400 animate-pulse' : ''
          }`}>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-700 flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
              {selectedPhonemes.map((p, idx) => (
                <span key={idx} className="flex items-center">
                  <span>{p.sound}</span>
                  {idx < selectedPhonemes.length - 1 && <span className="mx-1 text-gray-400">→</span>}
                </span>
              ))}
            </div>
            <button
              onClick={onCheckWord}
              className="bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-full font-bold transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              Check Word
            </button>
            {showError && (
              <X className="text-red-500" size={window.innerWidth < 640 ? 20 : 24} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhonemeBubbles;
import React from 'react';
import { Volume2 } from 'lucide-react';
import { pronounceWord } from '../utils/speechUtils';

const WordBubble = ({ currentWord, onWordClick }) => {
  const handleClick = () => {
    onWordClick();
    pronounceWord(currentWord.word);
  };

  return (
    <button
      onClick={handleClick}
      className="relative group transform scale-90 sm:scale-100"
    >
      <div className="absolute inset-0 bg-purple-400 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
      <div className="relative bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl sm:text-3xl md:text-4xl font-bold px-6 sm:px-10 md:px-12 py-4 sm:py-6 md:py-8 rounded-full shadow-2xl transform transition-transform group-hover:scale-105 cursor-pointer">
        {currentWord?.display}
      </div>
      <Volume2 className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-white rounded-full p-1 text-purple-600" size={window.innerWidth < 640 ? 24 : 32} />
    </button>
  );
};

export default WordBubble;
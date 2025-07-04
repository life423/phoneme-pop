import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGameState } from '../hooks/useGameState';
import { pronounceWord } from '../utils/speechUtils';
import GameHeader from './GameHeader';
import InstructionsPanel from './InstructionsPanel';
import WordBubble from './WordBubble';
import TipsCarousel from './TipsCarousel';
import PhonemeBubbles from './PhonemeBubbles';
import CelebrationOverlay from './CelebrationOverlay';
import ProgressBar from './ProgressBar';

const PhonemeSeparationGame = () => {
  const {
    currentWord,
    phonemes,
    setPhonemes,
    isSegmented,
    setIsSegmented,
    score,
    setScore,
    streak,
    setStreak,
    level,
    selectedPhonemes,
    setSelectedPhonemes,
    showCelebration,
    setShowCelebration,
    attemptedWords,
    setAttemptedWords,
    showError,
    setShowError,
    celebrationTimeoutRef,
    selectNewWord
  } = useGameState();

  const [showInstructions, setShowInstructions] = useState(false);

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setShowInstructions(window.innerWidth > 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle word bubble click - segment into phonemes
  const handleWordClick = () => {
    if (!isSegmented && currentWord) {
      setIsSegmented(true);
      
      const newPhonemes = currentWord.phonemes.map((phoneme, index) => ({
        id: `${currentWord.word}-${index}`,
        sound: phoneme,
        index: index,
        x: 0,
        y: 0
      }));
      
      const shuffledPhonemes = [...newPhonemes].sort(() => Math.random() - 0.5);
      setPhonemes(shuffledPhonemes);
      setAttemptedWords(prev => new Set([...prev, currentWord.word]));
    }
  };

  // Handle phoneme selection for word building
  const handlePhonemeClick = (phoneme) => {
    const isAlreadySelected = selectedPhonemes.some(p => p.id === phoneme.id);
    
    if (isAlreadySelected) {
      const clickedIndex = selectedPhonemes.findIndex(p => p.id === phoneme.id);
      setSelectedPhonemes(selectedPhonemes.slice(0, clickedIndex));
    } else {
      setSelectedPhonemes([...selectedPhonemes, phoneme]);
    }
    
    setShowError(false);
  };

  // Check if selected phonemes form the original word IN THE CORRECT ORDER
  const checkWord = () => {
    const formedWord = selectedPhonemes.map(p => p.sound).join('');
    const correctWord = currentWord.phonemes.join('');
    
    if (formedWord === correctWord) {
      const isCorrectOrder = selectedPhonemes.every((phoneme, index) => {
        return phoneme.index === index;
      });
      
      if (isCorrectOrder) {
        setScore(score + 10 * level);
        setStreak(streak + 1);
        setShowCelebration(true);
        pronounceWord("Excellent! Great job!");
        
        if (celebrationTimeoutRef.current) {
          clearTimeout(celebrationTimeoutRef.current);
        }
        celebrationTimeoutRef.current = setTimeout(() => {
          setShowCelebration(false);
          selectNewWord();
        }, 2000);
      } else {
        setShowError(true);
        setStreak(0);
        pronounceWord("Check your order. Try again!");
        setTimeout(() => {
          setSelectedPhonemes([]);
          setShowError(false);
        }, 2000);
      }
    } else {
      setShowError(true);
      setStreak(0);
      pronounceWord("Not quite. Try again!");
      setTimeout(() => {
        setSelectedPhonemes([]);
        setShowError(false);
      }, 1500);
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-blue-50 to-purple-50 flex flex-col overflow-hidden">
      <GameHeader 
        showInstructions={showInstructions}
        setShowInstructions={setShowInstructions}
        level={level}
        score={score}
        streak={streak}
      />

      <InstructionsPanel 
        showInstructions={showInstructions}
        setShowInstructions={setShowInstructions}
      />

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
          {!isSegmented ? (
            <div className="flex flex-col items-center gap-4 sm:gap-6">
              <WordBubble 
                currentWord={currentWord}
                onWordClick={handleWordClick}
              />
              <TipsCarousel />
            </div>
          ) : (
            <PhonemeBubbles 
              phonemes={phonemes}
              selectedPhonemes={selectedPhonemes}
              onPhonemeClick={handlePhonemeClick}
              onCheckWord={checkWord}
              showError={showError}
            />
          )}
        </div>

        <CelebrationOverlay showCelebration={showCelebration} />

        {isSegmented && (
          <button
            onClick={selectNewWord}
            className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 md:bottom-8 md:right-8 bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-3 rounded-full font-bold transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
          >
            <RefreshCw size={window.innerWidth < 640 ? 16 : 20} />
            <span className="hidden sm:inline">Next Word</span>
            <span className="sm:hidden">Next</span>
          </button>
        )}
      </div>

      <ProgressBar level={level} attemptedWords={attemptedWords} />
    </div>
  );
};

export default PhonemeSeparationGame;
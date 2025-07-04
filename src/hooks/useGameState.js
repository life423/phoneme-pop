import { useState, useEffect, useRef } from 'react';
import { wordLists } from '../data/wordLists';

export const useGameState = () => {
  const [currentWord, setCurrentWord] = useState(null);
  const [phonemes, setPhonemes] = useState([]);
  const [isSegmented, setIsSegmented] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [selectedPhonemes, setSelectedPhonemes] = useState([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [attemptedWords, setAttemptedWords] = useState(new Set());
  const [showError, setShowError] = useState(false);
  
  const celebrationTimeoutRef = useRef(null);

  // Select a new word from current level
  const selectNewWord = () => {
    const availableWords = wordLists[level].filter(w => !attemptedWords.has(w.word));
    
    if (availableWords.length === 0) {
      // Level complete - advance to next level
      if (level < 3) {
        setLevel(level + 1);
        setAttemptedWords(new Set());
        return;
      } else {
        // Game complete - restart
        setLevel(1);
        setAttemptedWords(new Set());
        return;
      }
    }
    
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWord(randomWord);
    setPhonemes([]);
    setIsSegmented(false);
    setSelectedPhonemes([]);
    setShowError(false);
  };

  // Initialize with a word
  useEffect(() => {
    if (!currentWord) {
      selectNewWord();
    }
  }, [level]);

  return {
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
  };
};
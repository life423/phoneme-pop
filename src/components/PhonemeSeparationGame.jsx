import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGameState } from '../hooks/useGameState.js';
import { checkAnswer, makeTiles, pickNextWord, shuffleTiles } from '../game/logic.js';
import { speak } from '../utils/speechUtils.js';
import GameHeader from './GameHeader.jsx';
import InstructionsPanel from './InstructionsPanel.jsx';
import WordBubble from './WordBubble.jsx';
import TipsCarousel from './TipsCarousel.jsx';
import PhonemeBubbles from './PhonemeBubbles.jsx';
import CelebrationOverlay from './CelebrationOverlay.jsx';
import ProgressBar from './ProgressBar.jsx';

const CELEBRATION_MS = 1800;
const FEEDBACK_MS = 1600;

// The how-to panel opens on first load for wide screens only; after that it's the player's call.
const opensByDefault = () => window.matchMedia('(min-width: 768px)').matches;

export default function PhonemeSeparationGame() {
  const [state, dispatch] = useGameState();
  const [showInstructions, setShowInstructions] = useState(opensByDefault);
  const { word, phase, tiles, selected, feedback, level, score, streak, solved } = state;

  const goToNextWord = () => {
    const next = pickNextWord({ level, solved, currentWord: word });
    if (next.levelUp) speak(`Level ${next.level}!`);
    dispatch({ type: 'next', next });
  };

  // Timers live in effects, so moving to another word cancels them automatically.
  useEffect(() => {
    if (phase !== 'celebrating') return undefined;
    const timer = setTimeout(goToNextWord, CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [phase, word]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'clearFeedback' }), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback, dispatch]);

  const splitWord = () => {
    speak(word.word);
    dispatch({ type: 'split', tiles: shuffleTiles(makeTiles(word)) });
  };

  const check = () => {
    const result = checkAnswer(selected, word);
    if (result === 'correct') {
      dispatch({ type: 'correct' });
      speak(`${word.word}! Great job!`);
    } else {
      dispatch({ type: 'miss', reason: result });
      speak(result === 'incomplete' ? 'Use all the sounds.' : 'Check your order. Try again!');
    }
  };

  return (
    <div className='min-h-dvh flex flex-col bg-gradient-to-b from-blue-50 to-purple-50'>
      <GameHeader
        showInstructions={showInstructions}
        onToggleInstructions={() => setShowInstructions((open) => !open)}
        level={level}
        score={score}
        streak={streak}
      />
      {showInstructions && <InstructionsPanel onClose={() => setShowInstructions(false)} />}

      <main className='relative flex-1 flex flex-col items-center justify-center gap-4 px-3 py-4 sm:py-6'>
        {phase === 'word' ? (
          <>
            <WordBubble key={word.word} word={word} onSplit={splitWord} />
            <TipsCarousel />
          </>
        ) : (
          <PhonemeBubbles
            tiles={tiles}
            selected={selected}
            feedback={feedback}
            locked={phase === 'celebrating'}
            onTileClick={(tile) => dispatch({ type: 'toggleTile', tile })}
            onCheck={check}
            onHearWord={() => speak(word.word)}
          />
        )}
        <CelebrationOverlay show={phase === 'celebrating'} />
      </main>

      <footer className='bg-white border-t px-3 py-2 sm:px-4 sm:py-3'>
        <div className='max-w-7xl mx-auto flex items-center gap-4'>
          <ProgressBar level={level} solvedCount={solved.size} />
          {phase !== 'word' && (
            <button
              type='button'
              onClick={goToNextWord}
              className='flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-purple-600 px-4 py-2 text-sm sm:text-base font-bold text-purple-700 hover:bg-purple-50'
            >
              <RefreshCw className='w-4 h-4' aria-hidden='true' />
              Next word
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

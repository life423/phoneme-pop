import { ChevronDown, ChevronUp, Home, Trophy } from 'lucide-react';
import { Link } from '../router.jsx';

function Stat({ label, value, tone, children }) {
  return (
    <div className='text-center'>
      <div className='text-xs sm:text-sm text-gray-600'>{label}</div>
      <div className={`flex items-center justify-center gap-1 text-lg sm:text-xl md:text-2xl font-bold ${tone}`}>
        {value}
        {children}
      </div>
    </div>
  );
}

export default function GameHeader({ showInstructions, onToggleInstructions, level, score, streak }) {
  const Chevron = showInstructions ? ChevronUp : ChevronDown;
  return (
    <header className='bg-white shadow-md px-3 py-2 sm:px-4 sm:py-3'>
      <div className='max-w-7xl mx-auto flex items-center justify-between gap-3'>
        <div className='flex items-center gap-1 sm:gap-3'>
          <Link to='/' aria-label='All activities' className='rounded-full p-2 text-purple-700 hover:bg-purple-100'>
            <Home className='w-5 h-5' aria-hidden='true' />
          </Link>
          <h1 className='text-xl md:text-2xl font-bold text-purple-700'>Phoneme Pop!</h1>
          <button
            type='button'
            onClick={onToggleInstructions}
            aria-expanded={showInstructions}
            aria-controls='how-to-play'
            aria-label='How to play'
            className='flex items-center gap-1 rounded-full px-2 sm:px-3 py-1.5 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors'
          >
            <span className='hidden sm:inline'>How to play</span>
            <Chevron className='w-4 h-4' aria-hidden='true' />
          </button>
        </div>
        <div className='flex items-center gap-3 sm:gap-6'>
          <Stat label='Level' value={level} tone='text-purple-700' />
          <Stat label='Score' value={score} tone='text-green-700' />
          <Stat label='Streak' value={streak} tone='text-orange-600'>
            {streak >= 3 && <Trophy className='w-4 h-4 sm:w-5 sm:h-5 text-orange-500' aria-label='On a roll!' />}
          </Stat>
        </div>
      </div>
    </header>
  );
}

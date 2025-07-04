# Phoneme Pop! 🎯

An educational phonics game designed to help children with dyslexia learn phoneme segmentation and blending through multisensory learning.

## Features

- **Phoneme Segmentation**: Break words into individual sounds
- **Sequential Ordering**: Practice putting sounds back in correct order
- **Multisensory Learning**: Visual symbols, audio feedback, and diacritical marks
- **Progressive Difficulty**: 3 levels from CVC words to complex patterns
- **Speech Synthesis**: Built-in text-to-speech for pronunciation
- **Responsive Design**: Works on desktop, tablet, and mobile

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env
   ```

3. **Start development server**
   ```bash
   npm start
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/           # React components
│   ├── PhonemeSeparationGame.js  # Main game component
│   ├── GameHeader.js            # Score and level display
│   ├── InstructionsPanel.js     # How to play instructions
│   ├── WordBubble.js            # Initial word display
│   ├── PhonemeBubbles.js        # Individual phoneme bubbles
│   ├── TipsCarousel.js          # Educational tips rotation
│   ├── CelebrationOverlay.js    # Success animation
│   └── ProgressBar.js           # Level progress indicator
├── data/                # Game data
│   ├── educationalTips.js       # Learning tips and hints
│   ├── phonemeSymbols.js        # Visual symbols for sounds
│   └── wordLists.js             # Words organized by difficulty
├── hooks/               # Custom React hooks
│   └── useGameState.js          # Game state management
├── utils/               # Utility functions
│   ├── speechUtils.js           # Text-to-speech functionality
│   └── diacriticalUtils.js      # Phonetic marking helpers
├── App.js               # Main app component
├── index.js             # React entry point
└── index.css            # Global styles with Tailwind
```

## Educational Approach

- **Diacritical Marks**: Uses breve (˘) for short vowels, macron (¯) for long vowels
- **Visual Mnemonics**: Each phoneme has an associated emoji and hint
- **Structured Progression**: CVC → Blends/Digraphs → Complex Patterns
- **Immediate Feedback**: Audio and visual confirmation of correct/incorrect attempts

## Technologies

- React 18
- Tailwind CSS
- Lucide React (icons)
- Web Speech API (text-to-speech)

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript
- Web Speech API (for audio feedback)
- CSS Grid and Flexbox
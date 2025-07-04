export const pronounceWord = (text) => {
  if ('speechSynthesis' in window && process.env.REACT_APP_ENABLE_SPEECH === 'true') {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = parseFloat(process.env.REACT_APP_SPEECH_RATE) || 0.8;
    utterance.pitch = parseFloat(process.env.REACT_APP_SPEECH_PITCH) || 1.1;
    speechSynthesis.speak(utterance);
  }
};
// Function to add diacritical marks to phonemes
export const addDiacriticalMarks = (phoneme, wordContext = '') => {
  // Short vowels get breve (˘)
  const shortVowels = {
    'a': 'ă',  // as in cat
    'e': 'ĕ',  // as in bed
    'i': 'ĭ',  // as in sit
    'o': 'ŏ',  // as in hot
    'u': 'ŭ'   // as in cup
  };
  
  // Long vowels get macron (¯)
  const longVowels = {
    'a_e': 'ā',  // as in cake
    'ee': 'ē',   // as in see
    'ea': 'ē',   // as in beach (when long)
    'igh': 'ī',  // as in light
    'i_e': 'ī',  // as in kite
    'oa': 'ō',   // as in boat
    'o_e': 'ō',  // as in home
    'ue': 'ū',   // as in blue
    'u_e': 'ū'   // as in cute
  };
  
  // Check if it's a short vowel (single vowel in CVC pattern)
  if (shortVowels[phoneme]) {
    return shortVowels[phoneme];
  }
  
  // Check if it's a long vowel pattern
  if (longVowels[phoneme]) {
    return longVowels[phoneme];
  }
  
  // Return unchanged if not a vowel needing marks
  return phoneme;
};
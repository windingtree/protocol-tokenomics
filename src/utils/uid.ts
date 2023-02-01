let lastKnownSeed = 0;

// Generates simple unique Id
export const simpleUid = (length = 11): string => {
  if (length < 5 || length > 11) {
    throw new Error('length value must be between 5 and 11');
  }
  lastKnownSeed = lastKnownSeed + Math.random();
  return lastKnownSeed.toString(16).slice(2, length);
};

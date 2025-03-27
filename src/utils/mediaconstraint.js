export const LOW_QUALITY_CONSTRAINTS = {
    audio: true,
    video: {
      width: { ideal: 240 },
      height: { ideal: 240 },
      frameRate: { max: 10 },
      aspectRatio: 1,
      facingMode: 'user',
      resizeMode: 'crop-and-scale'
    }
  };
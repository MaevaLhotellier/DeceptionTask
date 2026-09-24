export const playNotificationSound = (audioPath: string) => {
  const audio = new Audio(audioPath);

  audio.play().catch((error) => {
    console.warn(
      'Audio playback was blocked by the browser. The participant may need to interact with the page first:',
      error,
    );
  });
};

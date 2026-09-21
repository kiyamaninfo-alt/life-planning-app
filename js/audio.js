// Web Audio Synthesizer (චයිම් ශබ්ද ප්‍රයෝග)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playChime() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 Note
  osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5 Note
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

/** Race sound effects on the Web Audio API: preloaded once, started only after the viewer presses Play. */
export type Cue = 'jump' | 'coin' | 'crash' | 'tab' | 'purr';

const FILES: Record<Cue, string> = {
  jump: '/assets/sounds/jump.wav', coin: '/assets/sounds/coin.wav', crash: '/assets/sounds/crash.wav',
  tab: '/assets/sounds/tab.wav', purr: '/assets/sounds/purr.mp3',
};
/** Per-file volume, so the louder coin does not drown the short jump blip. */
const LEVEL: Record<Cue, number> = { jump: .32, coin: .24, crash: .42, tab: .3, purr: .5 };
const MAX_VOICES = 6;

let context: AudioContext | null = null;
const buffers = new Map<Cue, AudioBuffer>();
const lastStart = new Map<string, number>();
const playing = new Set<AudioBufferSourceNode>();
const purrs = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();

/** Call from a click: browsers only allow audio after a user gesture. */
export function unlockSfx() {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return;
  if (!context) {
    const ctx = context = new AudioContext();
    for (const cue of Object.keys(FILES) as Cue[]) {
      fetch(FILES[cue]).then((response) => response.arrayBuffer()).then((data) => ctx.decodeAudioData(data))
        .then((buffer) => { buffers.set(cue, buffer); }).catch(() => { /* a missing sound stays silent */ });
    }
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
}

/** Plays a cue now. `rate` shifts pitch and speed; `length` fades it out after that many seconds. */
export function playSfx(cue: Cue, { rate = 1, gain = 1, length }: { rate?: number; gain?: number; length?: number } = {}) {
  const buffer = buffers.get(cue);
  if (!context || !buffer || context.state !== 'running' || playing.size >= MAX_VOICES) return;
  // the same sound at the same pitch twice within 60ms reads as one
  const key = `${cue}:${rate}`, now = context.currentTime;
  if (now - (lastStart.get(key) ?? -1) < .06) return;
  lastStart.set(key, now);
  const source = context.createBufferSource(), volume = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  volume.gain.value = LEVEL[cue] * gain;
  if (length) volume.gain.setTargetAtTime(0, now + length, .25);
  source.connect(volume).connect(context.destination);
  playing.add(source);
  const purr = cue === 'purr' ? { source, gain: volume } : null;
  if (purr) purrs.add(purr);
  source.onended = () => { playing.delete(source); if (purr) purrs.delete(purr); };
  source.start();
  if (length) source.stop(now + length + 1.2);
}

/** Fades out a running purr, e.g. when the race restarts. */
export function hushSfx() {
  if (!context) return;
  for (const { source, gain } of purrs) { gain.gain.setTargetAtTime(0, context.currentTime, .08); source.stop(context.currentTime + .4); }
}

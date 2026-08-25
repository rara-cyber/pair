/**
 * The click from Tempo, ported to Web Audio.
 *
 * Same model as `Media.tickSamples` over there: a very short noise burst driving
 * a two-pole resonator under a steep amplitude envelope, which is roughly what a
 * switch and its housing actually do. A pure sine pip sounds like a beep; this
 * sounds like a click.
 *
 * The generator is a fixed-seed LCG, so the tick is identical on every play —
 * the same property Tempo relies on, and the reason this is rendered once into a
 * buffer and replayed rather than re-synthesised per click.
 */

interface Preset {
  /** Resonant frequency of the housing, in Hz. Sets how bright the click reads. */
  frequency: number;
  /** Pole radius of the resonator — how much the body rings. */
  resonance: number;
  /** Amplitude decay rate. Higher dies faster. */
  decay: number;
  /** Length of the exciting noise burst, in seconds. This is the "strike". */
  burst: number;
  duration: number;
  gain: number;
}

/** Tempo's "Click" preset — a standard mouse button. Its default, and ours. */
const CLICK: Preset = {
  frequency: 1600,
  resonance: 0.997,
  decay: 700,
  burst: 0.0005,
  duration: 0.022,
  // ponytail: Tempo uses 0.45, which is a foreground sound. A slider tick is
  // incidental and fires many times in a drag, so it sits lower.
  gain: 0.22,
};

/**
 * One click as raw mono samples. Pure maths, no audio device — which is what
 * makes it checkable against the Swift original.
 */
export function renderClick(rate: number, p: Preset = CLICK): Float32Array {
  const n = Math.max(1, Math.trunc(rate * p.duration));
  const out = new Float32Array(n);

  // Fixed seed, so the tick never varies. Math.imul and >>> 0 reproduce Swift's
  // UInt32 `&*` / `&+` wraparound exactly; plain `*` would lose the low bits
  // once the product passes 2^53 and quietly desynchronise the noise sequence.
  let seed = 0x5eed;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return ((seed >>> 8) & 0xffff) / 32768 - 1;
  };

  const w = (2 * Math.PI * p.frequency) / rate;
  const a1 = 2 * p.resonance * Math.cos(w);
  const a2 = -(p.resonance * p.resonance);
  const burst = Math.max(1, Math.trunc(rate * p.burst));

  let y1 = 0;
  let y2 = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const x = i < burst ? noise() : 0;
    const y = x + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y;
    const v = y * Math.exp((-i / rate) * p.decay);
    out[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }

  // Normalise to the preset's gain so the level is predictable whatever the
  // resonator happened to do.
  const scale = peak > 0 ? p.gain / peak : 0;
  for (let i = 0; i < n; i++) out[i] *= scale;
  return out;
}

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;

/**
 * Play one click. Safe to call on every step of a drag: the buffer is rendered
 * once and each play is just a source node.
 */
export function playClick(): void {
  try {
    if (!ctx) ctx = new AudioContext();
    // An AudioContext constructed outside a user gesture starts suspended. Every
    // call here is inside one (a drag, a click), so this is where it can resume.
    if (ctx.state === "suspended") void ctx.resume();

    if (!buffer) {
      const samples = renderClick(ctx.sampleRate);
      buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch {
    // No output device, or a policy that refuses to play. A slider that moves
    // silently is a far better outcome than one that throws mid-drag.
  }
}

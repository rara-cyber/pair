/**
 * Self-check for the click synth (`npm run check`).
 *
 * The reference values below were produced by running tempo's own Swift
 * `Media.tickSamples(.click, rate: 48000)`. They are here so that a change to
 * the LCG, the resonator or the envelope has to be deliberate: a port that
 * silently desynchronises still makes *a* noise, which is exactly the kind of
 * break nobody notices.
 *
 * Deliberately free of node imports — this file sits inside the client's
 * TypeScript project and must type-check under its browser lib.
 */
import { renderClick } from "./click";

const TEMPO_CLICK = { frequency: 1600, resonance: 0.997, decay: 700, burst: 0.0005, duration: 0.022, gain: 0.45 };

// Swift, 48 kHz, Tempo's own gain.
const REFERENCE = [-0.032298185, -0.055968158, -0.151097864, -0.099749327, -0.145047337];
const N = 1056;

function check(label: string, ok: boolean): void {
  if (!ok) throw new Error(`click.check: ${label}`);
}

const s = renderClick(48000, TEMPO_CLICK);

check(`length ${s.length} !== ${N}`, s.length === N);

for (let i = 0; i < REFERENCE.length; i++) {
  const diff = Math.abs(s[i] - REFERENCE[i]);
  check(`sample ${i} drifted from Swift by ${diff.toExponential(2)}`, diff < 1e-6);
}

// Normalisation is what keeps the level predictable whatever the resonator did.
let peak = 0;
for (const v of s) peak = Math.max(peak, Math.abs(v));
check(`peak ${peak} is not the preset gain`, Math.abs(peak - 0.45) < 1e-6);

// It has to be a click, not a tone: near-silent by the end of the buffer.
check("the tail never decays", Math.abs(s[N - 1]) < peak / 100);

// Fixed seed: the same tick every time, or the buffer could not be cached.
const again = renderClick(48000, TEMPO_CLICK);
check("two renders disagree", s.every((v, i) => v === again[i]));

// Every supported rate must produce a finite, non-empty buffer.
for (const rate of [22050, 44100, 48000, 96000]) {
  const r = renderClick(rate);
  check(`rate ${rate} produced nothing`, r.length > 0);
  check(`rate ${rate} produced a non-finite sample`, r.every(Number.isFinite));
}

console.log("click.check: all assertions passed");

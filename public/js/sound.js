import { onClockTick } from "./clock.js";

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioCtx();

// Browsers keep audio suspended until the user interacts with the page.
const unlock = () => {
    if (ctx.state === "suspended") {
        ctx.resume();
    }
};
window.addEventListener("click", unlock);
window.addEventListener("keydown", unlock);
window.addEventListener("touchstart", unlock);

// Gentle compressor so everything stays smooth and never harsh
const master = ctx.createDynamicsCompressor();
master.threshold.value = -18;
master.ratio.value = 4;

const volume = ctx.createGain();
volume.gain.value = 0.7;

master.connect(volume);
volume.connect(ctx.destination);

// Warm lowpass bus for the fanfare so the sawtooth is not piercing
const fanfareBus = ctx.createBiquadFilter();
fanfareBus.type = "lowpass";
fanfareBus.frequency.value = 3000;
fanfareBus.connect(master);

// One second of noise, reused by the tick click and the finale pop
const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
const noiseData = noiseBuffer.getChannelData(0);
for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1;
}

// Simple enveloped note
function note(type, freq, start, duration, peak, destination) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(destination || master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

function tick() {
    const now = ctx.currentTime;

    // Body: triangle wave dropping from 1200 Hz to 600 Hz
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.5, now + 0.002);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(now);
    osc.stop(now + 0.08);

    // Click: filtered noise burst on the attack
    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = noiseBuffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 2200;
    noiseFilter.Q.value = 1.5;
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 0.02);
}

// Last 10 seconds: a beep on top of the tick, higher for the final 3
function countdownBeep(secondsLeft) {
    const now = ctx.currentTime;
    if (secondsLeft <= 3) {
        note("square", 1320, now, 0.18, 0.25);
    } else {
        note("sine", 880, now, 0.12, 0.25);
    }
}

// At 00:00:00: cannon pop, low thump, rising fanfare, held chord, sparkles
function finale() {
    const now = ctx.currentTime;

    const pop = ctx.createBufferSource();
    const popFilter = ctx.createBiquadFilter();
    const popGain = ctx.createGain();
    pop.buffer = noiseBuffer;
    popFilter.type = "lowpass";
    popFilter.frequency.setValueAtTime(6000, now);
    popFilter.frequency.exponentialRampToValueAtTime(300, now + 0.25);
    popGain.gain.setValueAtTime(0.9, now);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    pop.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(master);
    pop.start(now);
    pop.stop(now + 0.35);

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(160, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    thumpGain.gain.setValueAtTime(0.9, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    thump.connect(thumpGain);
    thumpGain.connect(master);
    thump.start(now);
    thump.stop(now + 0.4);

    // Rising arpeggio: C5 E5 G5 C6
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, i) => {
        note("sawtooth", freq, now + 0.15 + i * 0.12, 0.25, 0.18, fanfareBus);
    });

    // Held final chord
    chord.forEach((freq) => {
        note("triangle", freq, now + 0.15 + chord.length * 0.12, 1.2, 0.2, fanfareBus);
    });

    // Sparkles that match the confetti rain
    for (let i = 0; i < 14; i++) {
        note("sine", 1800 + Math.random() * 2400, now + 0.3 + Math.random() * 1.4, 0.15, 0.08);
    }
}

onClockTick((str, previous) => {
    if (ctx.state !== "running") return;

    if (str === "00:00:00:00") {
        // No tick at zero. Finale only on a live transition.
        if (previous !== null && previous !== "00:00:00:00") finale();
        return;
    }

    const [days, hours, minutes, seconds] = str.split(":").map(Number);
    const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
    tick();
    if (total <= 10) countdownBeep(total);
});

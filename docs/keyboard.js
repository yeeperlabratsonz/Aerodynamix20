(() => {
    'use strict';

    /* ── DOM refs ── */
    const keyboard    = document.getElementById('piano-keyboard');
    const volumeInput = document.getElementById('keyboard-volume');
    const soundStatus = document.getElementById('sound-status');
    const noteStatus  = document.getElementById('note-status');
    const soundButtons = [...document.querySelectorAll('.sound-button')];
    const modeButtons  = [...document.querySelectorAll('.mode-button')];
    const workspace    = document.querySelector('.keyboard-workspace');
    const panicButton  = document.getElementById('panic-button');

    /* ── Note tables ── */
    // [name, freq, semitone-index-from-C4]
    const whiteNotes = [
        ['C4', 261.63, 0],  ['D4', 293.66, 2],  ['E4', 329.63, 4],
        ['F4', 349.23, 5],  ['G4', 392.00, 7],  ['A4', 440.00, 9],
        ['B4', 493.88, 11], ['C5', 523.25, 12], ['D5', 587.33, 14],
        ['E5', 659.25, 16], ['F5', 698.46, 17], ['G5', 783.99, 19],
        ['A5', 880.00, 21], ['B5', 987.77, 23], ['C6', 1046.50, 24],
    ];
    const blackNotes = [
        ['C#4', 277.18, 1,  0], ['D#4', 311.13, 3,  1],
        ['F#4', 369.99, 6,  3], ['G#4', 415.30, 8,  4], ['A#4', 466.16, 10, 5],
        ['C#5', 554.37, 13, 7], ['D#5', 622.25, 15, 8],
        ['F#5', 739.99, 18, 10],['G#5', 830.61, 20, 11],['A#5', 932.33, 22, 12],
    ];
    // Keyboard shortcuts
    const whiteHints = ['a','s','d','f','g','h','j','k','l',';','z','x','c','v','b'];
    const blackHints = ['w','e','t','y','u','o','p','[',']','-'];

    /* ── Lumi neon color palette (7 colors cycle across 25 semitones) ── */
    const lumiColors = [
        '#00f0ff', // cyan
        '#4d6dff', // electric blue
        '#ff2d9b', // bright pink
        '#b030ff', // purple
        '#ff00e8', // magenta
        '#39ff14', // lime green
        '#ffe600', // yellow
    ];

    /* ── Audio state ── */
    let audioContext  = null;
    let reverbNode    = null;   // shared ConvolverNode for Lumi reverb
    let selectedSound = 'flashing-synth';
    let keyboardMode  = 'synth';
    let masterVolume  = .68;
    const voices         = new Map();
    const heldKeys       = new Set();
    const activePointers = new Set();

    /* ── Sound profiles ── */
    const soundProfiles = {
        /*
         * Piano — multiple harmonic partials + felt-hammer noise burst
         */
        piano: {
            piano: true,
            attack: .004, decay: .34, sustain: .48, release: 1.15, gain: .32,
            partials: [
                ['sine',     1,    .58],
                ['triangle', 2,    .20],
                ['sine',     3,    .10],
                ['triangle', 4,    .055],
                ['sine',     5,    .030],
                ['sine',     7,    .018],
            ],
        },

        /*
         * Flashing Lights Synth — tight 4-osc electro lead inspired by the Kanye intro:
         * narrow detune, fast filter snap, short decay, restrained vibrato.
         */
        'flashing-synth': {
            supersaw: true,
            detunes: [-10, -3, 3, 10],
            attack: .012, decay: .28, sustain: .28, release: .32, gain: .17,
            filter: 1700, filterQ: 2.4,
            filterEnvelope: { start: 5200, end: 1700, duration: .22 },
            lfoRate: 5.1, lfoDepth: 2.2,
        },

        /*
         * Pop Synth — 5-osc wide supersaw, brighter and cleaner with octave sparkle.
         */
        'pop-synth': {
            supersaw: true,
            detunes: [-14, -6, 0, 6, 14],
            attack: .012, decay: .26, sustain: .52, release: .56, gain: .14,
            filter: 2600, filterQ: 1.05,
            filterEnvelope: { start: 6200, end: 2600, duration: .15 },
            lfoRate: 5.6, lfoDepth: 1.3,
            octaveMix: .16,
        },

        /*
         * Lumi Synth — vintage 80s/summer electro-pop brass lead.
         * Sawtooth + Square | punchy lowpass pluck (3500→1000 Hz, Q≈4.2) | hall reverb.
         */
        'lumi-synth': {
            lumi: true,
            attack: .01, decay: .35, sustain: .22, release: .7, gain: .22,
            filterStart: 3500, filterEnd: 1000, filterDuration: .35, filterQ: 4.2,
            reverbWet: .36, delayTime: .21, delayFeedback: .28, delayWet: .22,
        },

        /* Simple extras */
        organ: { wave: 'sine',     harmonic: 'sine',     harmonicRatio: 2,    harmonicGain: .50, attack: .06,  decay: .08, sustain: .75, release: .20,  gain: .22 },
        bell:  { wave: 'sine',     harmonic: 'triangle', harmonicRatio: 3.01, harmonicGain: .32, attack: .002, decay: 1.1, sustain: .03, release: 1.25, gain: .25 },
        bass:  { wave: 'sawtooth', harmonic: 'square',   harmonicRatio: 2,    harmonicGain: .08, attack: .012, decay: .30, sustain: .42, release: .40,  gain: .27, filter: 850 },
    };

    /* ── Audio context ── */
    function ensureAudio() {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();
        return audioContext;
    }

    /* ── Lumi reverb (lazily created once per context) ── */
    function ensureReverb(ctx) {
        if (reverbNode) return reverbNode;
        const sr  = ctx.sampleRate;
        const len = Math.ceil(sr * 2.2);
        const buf = ctx.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) {
            const ch = buf.getChannelData(c);
            for (let i = 0; i < len; i++) {
                const t    = i / sr;
                const fade = Math.min(1, t / .006);         // 6ms fade-in to kill click
                const decay = Math.pow(1 - t / 2.2, 2.6);
                ch[i] = (Math.random() * 2 - 1) * decay * fade;
            }
        }
        reverbNode = ctx.createConvolver();
        reverbNode.buffer = buf;
        reverbNode.connect(ctx.destination);
        return reverbNode;
    }

    /* ── Key factory ── */
    function makeKey(name, freq, semitone, isBlack, whiteIndex, hint) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = isBlack ? 'piano-key black-key' : 'piano-key';
        btn.dataset.note = name;
        btn.dataset.frequency = freq;

        // Rainbow hue (0-280°) based on white-key position
        const rainbowPos = isBlack ? whiteIndex + .5 : whiteIndex;
        btn.style.setProperty('--rainbow-hue', String(Math.round((rainbowPos / 14) * 280)));

        // Lumi neon color based on semitone position
        btn.style.setProperty('--lumi-color', lumiColors[semitone % 7]);

        btn.setAttribute('aria-label', `${name} key`);
        if (isBlack) btn.style.left = `calc(${((whiteIndex + 1) / whiteNotes.length) * 100}% - 17px)`;
        btn.innerHTML = `<span class="key-shortcut">${hint || ''}</span><span class="key-note">${name}</span>`;

        /* pointer events */
        btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            activePointers.add(e.pointerId);
            noteOn(name, freq, btn, true);
        });
        btn.addEventListener('pointerenter', e => {
            if (!activePointers.has(e.pointerId) || e.buttons !== 1) return;
            e.preventDefault();
            noteOn(name, freq, btn, true);
        });
        btn.addEventListener('pointerup',     e => { activePointers.delete(e.pointerId); noteOff(name); });
        btn.addEventListener('pointercancel', e => { activePointers.delete(e.pointerId); noteOff(name); });
        btn.addEventListener('pointerleave',  e => { if (activePointers.has(e.pointerId)) noteOff(name); });
        return btn;
    }

    /* Build the keyboard DOM */
    whiteNotes.forEach(([name, freq, semi], wi) =>
        keyboard.appendChild(makeKey(name, freq, semi, false, wi, whiteHints[wi])));
    blackNotes.forEach(([name, freq, semi, wi], bi) =>
        keyboard.appendChild(makeKey(name, freq, semi, true, wi, blackHints[bi])));

    /* ── noteOn ── */
    function noteOn(note, frequency, element, isPointer = false) {
        if (voices.has(note)) return;
        const ctx     = ensureAudio();
        const profile = soundProfiles[selectedSound];
        const now     = ctx.currentTime;
        const attack  = isPointer ? Math.min(profile.attack, .022) : profile.attack;
        const output  = ctx.createGain();
        const oscs    = [];

        /* ── Piano ── */
        if (profile.piano) {
            const lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.value = 5200;
            lpf.Q.value = .55;
            output.connect(lpf);
            lpf.connect(ctx.destination);

            profile.partials.forEach(([wave, ratio, level]) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = wave;
                osc.frequency.value = frequency * ratio;
                gain.gain.value = level;
                osc.connect(gain).connect(output);
                osc.start(now);
                oscs.push(osc);
            });

            // Felt-hammer noise burst
            const hLen = Math.ceil(ctx.sampleRate * .055);
            const hBuf = ctx.createBuffer(1, hLen, ctx.sampleRate);
            const hDat = hBuf.getChannelData(0);
            for (let i = 0; i < hLen; i++) hDat[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / hLen, 5);
            const hammer     = ctx.createBufferSource();
            const hammerBpf  = ctx.createBiquadFilter();
            const hammerGain = ctx.createGain();
            hammer.buffer = hBuf;
            hammerBpf.type = 'bandpass';
            hammerBpf.frequency.value = Math.min(3600, Math.max(1500, frequency * 4.5));
            hammerBpf.Q.value = .8;
            hammerGain.gain.value = .15;
            hammer.connect(hammerBpf).connect(hammerGain).connect(output);
            hammer.start(now);
            oscs.push(hammer);

        /* ── Supersaw (Flashing Lights / Pop Synth) ── */
        } else if (profile.supersaw) {
            const lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.Q.value = profile.filterQ;
            if (profile.filterEnvelope) {
                lpf.frequency.setValueAtTime(profile.filterEnvelope.start, now);
                lpf.frequency.exponentialRampToValueAtTime(profile.filterEnvelope.end, now + profile.filterEnvelope.duration);
            } else {
                lpf.frequency.value = profile.filter;
            }
            output.connect(lpf);
            lpf.connect(ctx.destination);

            const lfo     = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = profile.lfoRate;
            lfoGain.gain.value  = profile.lfoDepth;
            lfo.connect(lfoGain);

            profile.detunes.forEach(det => {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = frequency;
                osc.detune.value = det;
                lfoGain.connect(osc.detune);
                osc.connect(output);
                osc.start(now);
                oscs.push(osc);
            });
            if (profile.octaveMix) {
                const oct     = ctx.createOscillator();
                const octGain = ctx.createGain();
                oct.type = 'triangle';
                oct.frequency.value = frequency * 2;
                octGain.gain.value  = profile.octaveMix;
                lfoGain.connect(oct.detune);
                oct.connect(octGain).connect(output);
                oct.start(now);
                oscs.push(oct);
            }
            lfo.start(now);
            oscs.push(lfo);

        /* ── Lumi Synth ── */
        } else if (profile.lumi) {
            const reverb  = ensureReverb(ctx);

            // Sawtooth oscillator (main body)
            const saw  = ctx.createOscillator();
            saw.type = 'sawtooth';
            saw.frequency.value = frequency;

            // Square oscillator (brass bite, slightly detuned)
            const sqr     = ctx.createOscillator();
            const sqrGain = ctx.createGain();
            sqr.type = 'square';
            sqr.frequency.value = frequency;
            sqr.detune.value = -7;
            sqrGain.gain.value = .48;

            saw.connect(output);
            sqr.connect(sqrGain).connect(output);

            // Fast lowpass envelope: 3500 → 1000 Hz over 0.35s, Q≈4.2
            const lpf = ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.Q.value = profile.filterQ;
            lpf.frequency.setValueAtTime(profile.filterStart, now);
            lpf.frequency.exponentialRampToValueAtTime(profile.filterEnd, now + profile.filterDuration);

            output.connect(lpf);

            // Dry path
            const dry = ctx.createGain();
            dry.gain.value = 1 - profile.reverbWet;
            lpf.connect(dry);
            dry.connect(ctx.destination);

            // Reverb send
            const reverbSend = ctx.createGain();
            reverbSend.gain.value = profile.reverbWet;
            lpf.connect(reverbSend);
            reverbSend.connect(reverb);

            // Feedback delay
            const delay    = ctx.createDelay(.5);
            const feedback = ctx.createGain();
            const delayOut = ctx.createGain();
            delay.delayTime.value   = profile.delayTime;
            feedback.gain.value     = profile.delayFeedback;
            delayOut.gain.value     = profile.delayWet;
            lpf.connect(delay);
            delay.connect(feedback).connect(delay);  // feedback loop
            delay.connect(delayOut).connect(ctx.destination);

            saw.start(now);
            sqr.start(now);
            oscs.push(saw, sqr);

        /* ── Simple harmonic (organ, bell) ── */
        } else if (profile.harmonicGain) {
            const main     = ctx.createOscillator();
            const harm     = ctx.createOscillator();
            const harmGain = ctx.createGain();
            main.type = profile.wave;
            main.frequency.value = frequency;
            harm.type = profile.harmonic;
            harm.frequency.value = frequency * profile.harmonicRatio;
            harmGain.gain.value  = profile.harmonicGain;
            main.connect(output);
            harm.connect(harmGain).connect(output);
            if (profile.filter) {
                const lpf = ctx.createBiquadFilter();
                lpf.type = 'lowpass';
                lpf.frequency.value = profile.filter;
                lpf.Q.value = .8;
                output.connect(lpf);
                lpf.connect(ctx.destination);
            } else {
                output.connect(ctx.destination);
            }
            main.start(now);
            harm.start(now);
            oscs.push(main, harm);

        /* ── Single oscillator (bass, fallback) ── */
        } else {
            const osc = ctx.createOscillator();
            osc.type = profile.wave;
            osc.frequency.value = selectedSound === 'bass' ? frequency / 2 : frequency;
            osc.connect(output);
            output.connect(ctx.destination);
            osc.start(now);
            oscs.push(osc);
        }

        /* ── Volume envelope ── */
        output.gain.setValueAtTime(.0001, now);
        output.gain.exponentialRampToValueAtTime(Math.max(.001, profile.gain * masterVolume), now + attack);
        if (profile.piano) {
            // Two-stage piano decay
            output.gain.exponentialRampToValueAtTime(Math.max(.001, profile.gain * .56 * masterVolume), now + .22);
            output.gain.exponentialRampToValueAtTime(Math.max(.001, profile.gain * .19 * masterVolume), now + 1.4);
        } else {
            output.gain.exponentialRampToValueAtTime(
                Math.max(.001, profile.gain * profile.sustain * masterVolume),
                now + attack + profile.decay
            );
        }

        voices.set(note, { oscs, output, element, profile });
        element.classList.add('active');
        noteStatus.textContent = `${note}`;

        // Synth flash effect
        if (keyboardMode === 'synth' || keyboardMode === 'pop') {
            workspace.classList.remove('synth-flash');
            void workspace.offsetWidth;
            workspace.classList.add('synth-flash');
        }
    }

    /* ── noteOff ── */
    function noteOff(note) {
        const voice = voices.get(note);
        if (!voice) return;
        const ctx    = ensureAudio();
        const now    = ctx.currentTime;
        const stopAt = now + voice.profile.release + .06;
        voice.output.gain.cancelScheduledValues(now);
        voice.output.gain.setValueAtTime(Math.max(.0001, voice.output.gain.value), now);
        voice.output.gain.exponentialRampToValueAtTime(.0001, now + voice.profile.release);
        voice.oscs.forEach(o => { try { o.stop(stopAt); } catch (_) {} });
        voice.element.classList.remove('active');
        voices.delete(note);
    }

    /* ── stopAll ── */
    function stopAll() {
        [...voices.keys()].forEach(noteOff);
        heldKeys.clear();
        noteStatus.textContent = 'Click a key or use your keyboard';
    }

    /* ── Mode switcher ── */
    function setMode(mode) {
        keyboardMode  = mode;
        selectedSound = {
            piano: 'piano',
            synth: 'flashing-synth',
            pop:   'pop-synth',
            lumi:  'lumi-synth',
        }[mode] ?? 'piano';

        modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        soundButtons.forEach(b => b.classList.remove('active'));

        workspace.classList.toggle('synth-mode', mode === 'synth' || mode === 'pop');
        workspace.classList.toggle('lumi-mode',  mode === 'lumi');

        soundStatus.textContent = {
            piano: 'Standard Piano',
            synth: 'Flashing Lights Synth',
            pop:   'Pop Synth',
            lumi:  'Lumi Synth',
        }[mode] ?? selectedSound;
        stopAll();
    }

    /* ── Event wiring ── */
    const noteByHint = new Map();
    [...document.querySelectorAll('.piano-key')].forEach(el => {
        const hint = el.querySelector('.key-shortcut').textContent.trim();
        if (hint) noteByHint.set(hint, el);
    });

    document.addEventListener('keydown', e => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const key = e.key.toLowerCase();
        const el  = noteByHint.get(key);
        if (!el || document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        if (heldKeys.has(key)) return;
        heldKeys.add(key);
        noteOn(el.dataset.note, Number(el.dataset.frequency), el);
    });
    document.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        if (!heldKeys.has(key)) return;
        heldKeys.delete(key);
        noteOff(noteByHint.get(key)?.dataset.note);
    });

    modeButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    soundButtons.forEach(b => b.addEventListener('click', () => {
        selectedSound = b.dataset.sound;
        keyboardMode  = 'other';
        modeButtons.forEach(m => m.classList.remove('active'));
        workspace.classList.remove('synth-mode', 'lumi-mode');
        soundButtons.forEach(s => s.classList.toggle('active', s === b));
        soundStatus.textContent = b.textContent.trim();
        stopAll();
    }));

    volumeInput.addEventListener('input', () => { masterVolume = Number(volumeInput.value) / 100; });
    panicButton.addEventListener('click', stopAll);
    window.addEventListener('blur', stopAll);
    window.addEventListener('pointerup', e => { activePointers.delete(e.pointerId); stopAll(); });
})();

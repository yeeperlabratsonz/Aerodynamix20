(() => {
    'use strict';

    const keyboard = document.getElementById('piano-keyboard');
    const volumeInput = document.getElementById('keyboard-volume');
    const soundStatus = document.getElementById('sound-status');
    const noteStatus = document.getElementById('note-status');
    const soundButtons = [...document.querySelectorAll('.sound-button')];
    const modeButtons = [...document.querySelectorAll('.mode-button')];
    const workspace = document.querySelector('.keyboard-workspace');
    const panicButton = document.getElementById('panic-button');

    const whiteNotes = [
        ['C4', 261.63], ['D4', 293.66], ['E4', 329.63], ['F4', 349.23],
        ['G4', 392.00], ['A4', 440.00], ['B4', 493.88], ['C5', 523.25],
        ['D5', 587.33], ['E5', 659.25], ['F5', 698.46], ['G5', 783.99],
        ['A5', 880.00], ['B5', 987.77], ['C6', 1046.50]
    ];
    const blackNotes = [
        ['C#4', 277.18, 0], ['D#4', 311.13, 1], ['F#4', 369.99, 3],
        ['G#4', 415.30, 4], ['A#4', 466.16, 5], ['C#5', 554.37, 7],
        ['D#5', 622.25, 8], ['F#5', 739.99, 10], ['G#5', 830.61, 11],
        ['A#5', 932.33, 12]
    ];
    const keyHints = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', 'z', 'x', 'c', 'v', 'b'];
    const blackHints = ['w', 'e', 't', 'y', 'u', 'o', 'p', '[', ']', '-'];
    const voices = new Map();
    const heldKeys = new Set();
    const activePointers = new Set();
    let audioContext = null;
    let selectedSound = 'flashing-synth';
    let keyboardMode = 'synth';
    let masterVolume = .68;

    const soundProfiles = {
        piano: { wave: 'triangle', harmonic: 'sine', harmonicRatio: 2, harmonicGain: .12, attack: .006, decay: .38, sustain: .24, release: .58, gain: .28 },
        'flashing-synth': { wave: 'sawtooth', attack: .02, decay: .6, release: .12, gain: .24, filterEnvelope: { start: 3000, end: 800, duration: .3, q: 4 } },
        organ: { wave: 'sine', harmonic: 'sine', harmonicRatio: 2, harmonicGain: .5, attack: .06, decay: .08, sustain: .75, release: .2, gain: .22 },
        bell: { wave: 'sine', harmonic: 'triangle', harmonicRatio: 3.01, harmonicGain: .32, attack: .002, decay: 1.1, sustain: .03, release: 1.25, gain: .25 },
        bass: { wave: 'sawtooth', harmonic: 'square', harmonicRatio: 2, harmonicGain: .08, attack: .012, decay: .3, sustain: .42, release: .4, gain: .27, filter: 850 }
    };

    function ensureAudio() {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') audioContext.resume();
        return audioContext;
    }

    function makeKey(note, frequency, isBlack, index, hint) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = isBlack ? 'piano-key black-key' : 'piano-key';
        button.dataset.note = note;
        button.dataset.frequency = frequency;
        const rainbowPosition = isBlack ? index + .5 : index;
        button.style.setProperty('--rainbow-hue', `${Math.round((rainbowPosition / 14) * 280)}`);
        button.setAttribute('aria-label', `${note} key`);
        if (isBlack) button.style.left = `calc(${((index + 1) / whiteNotes.length) * 100}% - 17px)`;
        button.innerHTML = `<span class="key-shortcut">${hint || ''}</span><span class="key-note">${note}</span>`;
        button.addEventListener('pointerdown', event => {
            event.preventDefault();
            activePointers.add(event.pointerId);
            noteOn(note, frequency, button);
        });
        button.addEventListener('pointerenter', event => {
            if (!activePointers.has(event.pointerId) || event.buttons !== 1) return;
            event.preventDefault();
            noteOn(note, frequency, button);
        });
        button.addEventListener('pointerup', event => {
            activePointers.delete(event.pointerId);
            noteOff(note);
        });
        button.addEventListener('pointercancel', event => {
            activePointers.delete(event.pointerId);
            noteOff(note);
        });
        button.addEventListener('pointerleave', event => {
            if (activePointers.has(event.pointerId)) noteOff(note);
        });
        return button;
    }

    whiteNotes.forEach(([note, frequency], index) => keyboard.appendChild(makeKey(note, frequency, false, index, keyHints[index])));
    blackNotes.forEach(([note, frequency, index], position) => keyboard.appendChild(makeKey(note, frequency, true, index, blackHints[position])));

    function noteOn(note, frequency, element) {
        if (voices.has(note)) return;
        const context = ensureAudio();
        const profile = soundProfiles[selectedSound];
        const now = context.currentTime;
        const output = context.createGain();
        const main = context.createOscillator();
        main.type = profile.wave;
        main.frequency.value = profile.filter ? frequency / (selectedSound === 'bass' ? 2 : 1) : frequency;
        main.connect(output);
        let filter = null;
        let harmonic = null;
        if (profile.filterEnvelope) {
            filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = profile.filterEnvelope.q;
            filter.frequency.setValueAtTime(profile.filterEnvelope.start, now);
            filter.frequency.exponentialRampToValueAtTime(profile.filterEnvelope.end, now + profile.filterEnvelope.duration);
            output.connect(filter);
            filter.connect(context.destination);
        } else if (profile.harmonicGain) {
            harmonic = context.createOscillator();
            const harmonicGain = context.createGain();
            harmonic.type = profile.harmonic;
            harmonic.frequency.value = main.frequency.value * profile.harmonicRatio;
            harmonicGain.gain.value = profile.harmonicGain;
            harmonic.connect(harmonicGain).connect(output);
            output.connect(context.destination);
        } else if (profile.filter) {
            const filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = profile.filter;
            filter.Q.value = .8;
            output.connect(filter);
            filter.connect(context.destination);
        } else {
            output.connect(context.destination);
        }
        output.gain.setValueAtTime(.0001, now);
        output.gain.exponentialRampToValueAtTime(Math.max(.001, profile.gain * masterVolume), now + profile.attack);
        if (profile.filterEnvelope) {
            output.gain.exponentialRampToValueAtTime(.0001, now + profile.attack + profile.decay);
        } else {
            output.gain.exponentialRampToValueAtTime(Math.max(.001, profile.gain * profile.sustain * masterVolume), now + profile.attack + profile.decay);
        }
        main.start(now);
        if (harmonic) harmonic.start(now);
        voices.set(note, { main, harmonic, output, filter, element, profile });
        element.classList.add('active');
        noteStatus.textContent = `${note} · ${selectedSound}`;
        if (keyboardMode === 'synth') {
            workspace.classList.remove('synth-flash');
            void workspace.offsetWidth;
            workspace.classList.add('synth-flash');
        }
    }

    function noteOff(note) {
        const voice = voices.get(note);
        if (!voice) return;
        const now = ensureAudio().currentTime;
        voice.output.gain.cancelScheduledValues(now);
        voice.output.gain.setValueAtTime(Math.max(.001, voice.output.gain.value), now);
        voice.output.gain.exponentialRampToValueAtTime(.0001, now + voice.profile.release);
        voice.main.stop(now + voice.profile.release + .04);
        if (voice.harmonic) voice.harmonic.stop(now + voice.profile.release + .04);
        voice.element.classList.remove('active');
        voices.delete(note);
    }

    function stopAll() {
        [...voices.keys()].forEach(noteOff);
        heldKeys.clear();
        noteStatus.textContent = 'Click a key or use your keyboard';
    }

    const noteByHint = new Map();
    [...document.querySelectorAll('.piano-key')].forEach(element => {
        if (element.querySelector('.key-shortcut').textContent) noteByHint.set(element.querySelector('.key-shortcut').textContent, element);
    });
    document.addEventListener('keydown', event => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        const element = noteByHint.get(key);
        if (!element || document.activeElement?.tagName === 'INPUT') return;
        event.preventDefault();
        if (heldKeys.has(key)) return;
        heldKeys.add(key);
        noteOn(element.dataset.note, Number(element.dataset.frequency), element);
    });
    document.addEventListener('keyup', event => {
        const key = event.key.toLowerCase();
        if (!heldKeys.has(key)) return;
        heldKeys.delete(key);
        noteOff(noteByHint.get(key)?.dataset.note);
    });
    function setMode(mode) {
        keyboardMode = mode;
        selectedSound = mode === 'synth' ? 'flashing-synth' : 'piano';
        modeButtons.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
        workspace.classList.toggle('synth-mode', mode === 'synth');
        soundStatus.textContent = mode === 'synth' ? 'Flashing Lights Synth' : 'Standard Piano';
        stopAll();
    }
    modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
    soundButtons.forEach(button => button.addEventListener('click', () => {
        selectedSound = button.dataset.sound;
        keyboardMode = 'other';
        modeButtons.forEach(item => item.classList.remove('active'));
        workspace.classList.remove('synth-mode');
        soundButtons.forEach(item => item.classList.toggle('active', item === button));
        soundStatus.textContent = button.textContent;
        stopAll();
    }));
    volumeInput.addEventListener('input', () => { masterVolume = Number(volumeInput.value) / 100; });
    panicButton.addEventListener('click', stopAll);
    window.addEventListener('blur', stopAll);
    window.addEventListener('pointerup', event => {
        activePointers.delete(event.pointerId);
        stopAll();
    });
})();
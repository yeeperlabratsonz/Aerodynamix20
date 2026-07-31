(function () {
    'use strict';

    const STEP_COUNT = 16;
    const TRACKS = [
        { id: 'kick', name: 'Kick', icon: 'K', color: '#ef6f8f', type: 'kick', defaultSteps: [0, 4, 8, 10, 12] },
        { id: 'snare', name: 'Snare', icon: 'S', color: '#f5ae63', type: 'snare', defaultSteps: [4, 12] },
        { id: 'hat', name: 'Hi-hat', icon: 'H', color: '#66d7c0', type: 'hat', defaultSteps: [0, 2, 4, 6, 8, 10, 12, 14] },
        { id: 'clap', name: 'Clap', icon: 'C', color: '#bb91f1', type: 'clap', defaultSteps: [4, 12] },
        { id: 'bass', name: 'Bass', icon: 'B', color: '#73a8ff', type: 'bass', defaultSteps: [0, 3, 8, 10, 14] },
        { id: 'lead', name: 'Lead', icon: 'L', color: '#f2d56b', type: 'lead', defaultSteps: [2, 6, 10, 14] }
    ];

    const grid = document.getElementById('sequencer-grid');
    const playButton = document.getElementById('play-button');
    const stopButton = document.getElementById('stop-button');
    const transportStatus = document.getElementById('transport-status');
    const statusDot = document.getElementById('status-dot');
    const tempoInput = document.getElementById('tempo-input');
    const tempoValue = document.getElementById('tempo-value');
    const swingInput = document.getElementById('swing-input');
    const swingValue = document.getElementById('swing-value');
    const kitSelect = document.getElementById('kit-select');
    const audio = {
        context: null,
        master: null,
        scheduler: null,
        isPlaying: false,
        nextStepTime: 0,
        currentStep: 0
    };

    const pattern = Object.fromEntries(TRACKS.map(track => [track.id, new Set(track.defaultSteps)]));
    const muted = Object.fromEntries(TRACKS.map(track => [track.id, false]));
    const volumes = Object.fromEntries(TRACKS.map(track => [track.id, 0.8]));

    function render() {
        grid.innerHTML = '';
        TRACKS.forEach(track => {
            const row = document.createElement('div');
            row.className = 'sequencer-row';
            row.dataset.track = track.id;
            row.style.setProperty('--track-color', track.color);

            const info = document.createElement('div');
            info.className = 'track-info';
            info.innerHTML = `<span class="track-icon">${track.icon}</span><span class="track-name">${track.name}</span><div class="track-controls"><input class="track-volume" type="range" min="0" max="100" value="${volumes[track.id] * 100}" aria-label="${track.name} volume"><button class="mute-button" type="button" aria-label="Mute ${track.name}" title="Mute ${track.name}"><i class="fas fa-volume-high"></i></button></div>`;
            info.querySelector('.track-volume').addEventListener('input', event => { volumes[track.id] = Number(event.target.value) / 100; });
            info.querySelector('.mute-button').addEventListener('click', event => {
                muted[track.id] = !muted[track.id];
                event.currentTarget.classList.toggle('is-muted', muted[track.id]);
                event.currentTarget.innerHTML = `<i class="fas fa-volume-${muted[track.id] ? 'xmark' : 'high'}"></i>`;
            });
            row.appendChild(info);

            for (let step = 0; step < STEP_COUNT; step += 1) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'step-button';
                button.dataset.step = step;
                button.dataset.track = track.id;
                button.setAttribute('aria-label', `${track.name}, step ${step + 1}`);
                button.classList.toggle('is-on', pattern[track.id].has(step));
                button.addEventListener('click', () => {
                    if (pattern[track.id].has(step)) pattern[track.id].delete(step);
                    else pattern[track.id].add(step);
                    button.classList.toggle('is-on', pattern[track.id].has(step));
                    ensureAudio().then(() => previewStep(track, step));
                });
                row.appendChild(button);
            }
            grid.appendChild(row);
        });
    }

    function setStatus(text) {
        transportStatus.textContent = text;
        statusDot.classList.toggle('active', audio.isPlaying);
    }

    function ensureAudio() {
        if (!audio.context) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return Promise.reject(new Error('Web Audio is not supported'));
            audio.context = new AudioContext();
            audio.master = audio.context.createGain();
            audio.master.gain.value = 0.62;
            audio.master.connect(audio.context.destination);
        }
        return audio.context.state === 'suspended' ? audio.context.resume() : Promise.resolve();
    }

    function noiseBuffer() {
        const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 0.5, audio.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
        return buffer;
    }

    function envelope(gain, time, peak, duration) {
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.002, peak), time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    }

    function kitTone() {
        return kitSelect.value === 'punch' ? 1.18 : kitSelect.value === 'soft' ? 0.72 : 1;
    }

    function playKick(time, volume) {
        const oscillator = audio.context.createOscillator();
        const gain = audio.context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(145 * kitTone(), time);
        oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.16);
        envelope(gain, time, 0.9 * volume, 0.26);
        oscillator.connect(gain).connect(audio.master);
        oscillator.start(time);
        oscillator.stop(time + 0.3);
    }

    function playNoise(time, volume, duration, filterFrequency) {
        const source = audio.context.createBufferSource();
        const filter = audio.context.createBiquadFilter();
        const gain = audio.context.createGain();
        source.buffer = noiseBuffer();
        filter.type = 'bandpass';
        filter.frequency.value = filterFrequency;
        filter.Q.value = 0.8;
        envelope(gain, time, volume, duration);
        source.connect(filter).connect(gain).connect(audio.master);
        source.start(time);
        source.stop(time + duration + 0.04);
    }

    function playSnare(time, volume) {
        playNoise(time, 0.38 * volume, 0.18, 1800);
        const oscillator = audio.context.createOscillator();
        const gain = audio.context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 180;
        envelope(gain, time, 0.24 * volume, 0.1);
        oscillator.connect(gain).connect(audio.master);
        oscillator.start(time);
        oscillator.stop(time + 0.12);
    }

    function playClap(time, volume) {
        [0, 0.025, 0.05].forEach(offset => playNoise(time + offset, 0.24 * volume, 0.09, 1250));
    }

    function playHat(time, volume) {
        playNoise(time, 0.23 * volume, 0.045, 6500);
    }

    function playTone(time, volume, frequency, type, duration) {
        const oscillator = audio.context.createOscillator();
        const gain = audio.context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, time);
        envelope(gain, time, volume, duration);
        oscillator.connect(gain).connect(audio.master);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.04);
    }

    function playTrack(track, time) {
        if (muted[track.id]) return;
        const volume = volumes[track.id];
        if (track.type === 'kick') playKick(time, volume);
        if (track.type === 'snare') playSnare(time, volume);
        if (track.type === 'hat') playHat(time, volume);
        if (track.type === 'clap') playClap(time, volume);
        if (track.type === 'bass') {
            const notes = [65.41, 65.41, 77.78, 98, 87.31];
            playTone(time, 0.25 * volume, notes[Math.floor(Math.random() * notes.length)], 'sawtooth', 0.18);
        }
        if (track.type === 'lead') {
            const notes = [261.63, 329.63, 392, 493.88];
            playTone(time, 0.16 * volume, notes[Math.floor(Math.random() * notes.length)], 'triangle', 0.24);
        }
    }

    function markPlayhead(step) {
        document.querySelectorAll('.step-button.is-playing').forEach(button => button.classList.remove('is-playing'));
        document.querySelectorAll(`.step-button[data-step="${step}"]`).forEach(button => button.classList.add('is-playing'));
    }

    function scheduleStep(step, time) {
        TRACKS.forEach(track => {
            if (pattern[track.id].has(step)) playTrack(track, time);
        });
        const delay = Math.max(0, (time - audio.context.currentTime) * 1000);
        window.setTimeout(() => { if (audio.isPlaying) markPlayhead(step); }, delay);
    }

    function stepDuration() {
        const base = 60 / Number(tempoInput.value) / 4;
        return base * (audio.currentStep % 2 === 1 ? 1 + Number(swingInput.value) / 100 : 1 - Number(swingInput.value) / 100);
    }

    function scheduler() {
        while (audio.nextStepTime < audio.context.currentTime + 0.1) {
            scheduleStep(audio.currentStep, audio.nextStepTime);
            audio.nextStepTime += stepDuration();
            audio.currentStep = (audio.currentStep + 1) % STEP_COUNT;
        }
    }

    async function start() {
        try {
            await ensureAudio();
            audio.isPlaying = true;
            audio.currentStep = 0;
            audio.nextStepTime = audio.context.currentTime + 0.05;
            audio.scheduler = window.setInterval(scheduler, 25);
            playButton.classList.add('is-playing');
            playButton.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
            setStatus('Playing your loop');
        } catch (error) {
            setStatus('Audio is not available in this browser');
        }
    }

    function stop() {
        audio.isPlaying = false;
        if (audio.scheduler) window.clearInterval(audio.scheduler);
        audio.scheduler = null;
        document.querySelectorAll('.step-button.is-playing').forEach(button => button.classList.remove('is-playing'));
        playButton.classList.remove('is-playing');
        playButton.innerHTML = '<i class="fas fa-play"></i><span>Play</span>';
        setStatus('Ready to make a loop');
    }

    function previewStep(track, step) {
        if (!audio.context || audio.isPlaying || !pattern[track.id].has(step)) return;
        playTrack(track, audio.context.currentTime);
    }

    function updateStarter() {
        TRACKS.forEach(track => { pattern[track.id] = new Set(track.defaultSteps); });
        render();
    }

    function randomize() {
        TRACKS.forEach((track, index) => {
            pattern[track.id] = new Set();
            for (let step = 0; step < STEP_COUNT; step += 1) {
                const chance = index < 4 ? 0.2 : 0.16;
                if (Math.random() < chance) pattern[track.id].add(step);
            }
        });
        render();
    }

    function clearPattern() {
        TRACKS.forEach(track => { pattern[track.id] = new Set(); });
        render();
    }

    playButton.addEventListener('click', () => audio.isPlaying ? stop() : start());
    stopButton.addEventListener('click', stop);
    tempoInput.addEventListener('input', () => { tempoValue.textContent = tempoInput.value; });
    swingInput.addEventListener('input', () => { swingValue.textContent = `${swingInput.value}%`; });
    document.getElementById('demo-button').addEventListener('click', updateStarter);
    document.getElementById('random-button').addEventListener('click', randomize);
    document.getElementById('clear-pattern-button').addEventListener('click', clearPattern);
    document.addEventListener('keydown', event => {
        if (event.code === 'Space' && !['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) {
            event.preventDefault();
            audio.isPlaying ? stop() : start();
        }
    });
    window.addEventListener('beforeunload', stop);
    updateStarter();
})();
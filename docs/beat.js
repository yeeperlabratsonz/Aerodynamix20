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
    const songInput = document.getElementById('song-input');
    const songEmpty = document.getElementById('song-empty');
    const songLoaded = document.getElementById('song-loaded');
    const songToggle = document.getElementById('song-toggle');
    const songRemove = document.getElementById('song-remove');
    const songName = document.getElementById('song-name');
    const songDuration = document.getElementById('song-duration');
    const songProgress = document.getElementById('song-progress');
    const songTime = document.getElementById('song-time');
    const songSpeed = document.getElementById('song-speed');
    const songSpeedValue = document.getElementById('song-speed-value');
    const songPitch = document.getElementById('song-pitch');
    const songPitchValue = document.getElementById('song-pitch-value');
    const songVolume = document.getElementById('song-volume');
    const songVolumeValue = document.getElementById('song-volume-value');
    const songTone = document.getElementById('song-tone');
    const songLoop = document.getElementById('song-loop');
    const audio = {
        context: null,
        master: null,
        scheduler: null,
        isPlaying: false,
        nextStepTime: 0,
        currentStep: 0
    };
    const song = {
        buffer: null,
        source: null,
        gain: null,
        filter: null,
        offset: 0,
        startedAt: 0,
        playing: false,
        stopping: false,
        raf: null
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

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${remainder}`;
    }

    function songRate() {
        return Number(songSpeed.value) / 100 * Math.pow(2, Number(songPitch.value) / 12);
    }

    function songPosition() {
        if (!song.buffer) return 0;
        if (!song.playing) return song.offset;
        return song.offset + (audio.context.currentTime - song.startedAt) * songRate();
    }

    function updateSongProgress() {
        if (!song.buffer) return;
        let position = songPosition();
        if (songLoop.checked) position %= song.buffer.duration;
        else position = Math.min(position, song.buffer.duration);
        songProgress.value = position;
        songTime.textContent = formatTime(position);
        if (song.playing) song.raf = window.requestAnimationFrame(updateSongProgress);
    }

    function updateSongFilter() {
        if (!song.filter) return;
        song.filter.type = songTone.value === 'drum' ? 'highpass' : songTone.value === 'bass' ? 'lowshelf' : 'allpass';
        if (songTone.value === 'drum') song.filter.frequency.value = 100;
        if (songTone.value === 'bass') song.filter.frequency.value = 180;
        song.filter.gain.value = songTone.value === 'bass' ? 5 : 0;
    }

    function updateSongGain() {
        if (song.gain) song.gain.gain.value = Number(songVolume.value) / 100;
    }

    function connectSongSource(source) {
        if (!song.filter) {
            song.filter = audio.context.createBiquadFilter();
            song.gain = audio.context.createGain();
            song.filter.connect(song.gain).connect(audio.master);
        }
        updateSongFilter();
        updateSongGain();
        source.connect(song.filter);
    }

    function createSongSource(offset) {
        const source = audio.context.createBufferSource();
        source.buffer = song.buffer;
        source.loop = songLoop.checked;
        source.playbackRate.value = Number(songSpeed.value) / 100;
        source.detune.value = Number(songPitch.value) * 100;
        connectSongSource(source);
        source.onended = () => {
            if (song.source !== source || song.stopping) return;
            song.source = null;
            song.playing = false;
            song.offset = 0;
            songProgress.value = 0;
            songTime.textContent = '0:00';
            updateSongButton();
        };
        source.start(audio.context.currentTime, Math.max(0, Math.min(offset, song.buffer.duration - .001)));
        return source;
    }

    function updateSongButton() {
        songToggle.classList.toggle('is-playing', song.playing);
        songToggle.innerHTML = song.playing
            ? '<i class="fas fa-pause"></i><span>Pause song</span>'
            : '<i class="fas fa-play"></i><span>Play song</span>';
        if (song.playing) {
            window.cancelAnimationFrame(song.raf);
            song.raf = window.requestAnimationFrame(updateSongProgress);
        }
    }

    async function startSong() {
        if (!song.buffer || song.playing) return;
        await ensureAudio();
        song.stopping = false;
        song.startedAt = audio.context.currentTime;
        song.source = createSongSource(song.offset);
        song.playing = true;
        updateSongButton();
    }

    function stopSong(resetPosition) {
        if (song.playing && song.source) {
            song.offset = songPosition();
            if (songLoop.checked) song.offset %= song.buffer.duration;
            song.stopping = true;
            try { song.source.stop(); } catch (error) { /* already stopped */ }
            song.source.disconnect();
            song.source = null;
        }
        song.playing = false;
        song.stopping = false;
        if (resetPosition) song.offset = 0;
        window.cancelAnimationFrame(song.raf);
        updateSongButton();
        updateSongProgress();
    }

    function restartSongAtPosition() {
        if (!song.playing) return;
        const position = songPosition();
        stopSong(false);
        song.offset = position >= song.buffer.duration ? 0 : position;
        startSong();
    }

    async function loadSong(file) {
        if (!file || !file.type.startsWith('audio/')) return;
        stopSong(true);
        try {
            await ensureAudio();
            const data = await file.arrayBuffer();
            song.buffer = await audio.context.decodeAudioData(data);
            song.offset = 0;
            songName.textContent = file.name;
            songDuration.textContent = formatTime(song.buffer.duration);
            songProgress.max = song.buffer.duration;
            songProgress.value = 0;
            songTime.textContent = '0:00';
            songEmpty.hidden = true;
            songLoaded.hidden = false;
            setStatus('Song loaded — press Play to layer your beat');
        } catch (error) {
            song.buffer = null;
            setStatus('That audio file could not be loaded');
        } finally {
            songInput.value = '';
        }
    }

    function removeSong() {
        stopSong(true);
        song.buffer = null;
        song.name = '';
        songEmpty.hidden = false;
        songLoaded.hidden = true;
        setStatus('Ready to make a loop');
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
            if (song.buffer && !song.playing) await startSong();
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
        stopSong(true);
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
    songInput.addEventListener('change', () => loadSong(songInput.files[0]));
    songToggle.addEventListener('click', () => {
        if (song.playing) stopSong(false);
        else startSong();
    });
    songRemove.addEventListener('click', removeSong);
    songProgress.addEventListener('input', () => {
        song.offset = Number(songProgress.value);
        songTime.textContent = formatTime(song.offset);
        if (song.playing) restartSongAtPosition();
    });
    songSpeed.addEventListener('input', () => {
        songSpeedValue.textContent = `${songSpeed.value}%`;
        restartSongAtPosition();
    });
    songPitch.addEventListener('input', () => {
        const value = Number(songPitch.value);
        songPitchValue.textContent = `${value > 0 ? '+' : ''}${value} st`;
        restartSongAtPosition();
    });
    songVolume.addEventListener('input', () => {
        songVolumeValue.textContent = `${songVolume.value}%`;
        updateSongGain();
    });
    songTone.addEventListener('change', updateSongFilter);
    songLoop.addEventListener('change', () => {
        if (song.playing) restartSongAtPosition();
    });
    document.addEventListener('keydown', event => {
        if (event.code === 'Space' && !['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) {
            event.preventDefault();
            audio.isPlaying ? stop() : start();
        }
    });
    window.addEventListener('beforeunload', stop);
    updateStarter();
})();
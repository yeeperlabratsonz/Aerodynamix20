(function () {
    'use strict';

    const STEMS = [
        { id: 'vocals', label: 'Vocals', icon: 'microphone', color: '#d994f4' },
        { id: 'drums', label: 'Drums', icon: 'drum', color: '#ef6f8f' },
        { id: 'bass', label: 'Bass', icon: 'music', color: '#73a8ff' },
        { id: 'other', label: 'Other', icon: 'wave-square', color: '#67ddc0' }
    ];

    const songInput = document.getElementById('song-input');
    const uploadDropzone = document.getElementById('upload-dropzone');
    const uploadFileName = document.getElementById('upload-file-name');
    const separateButton = document.getElementById('separate-button');
    const newSongButton = document.getElementById('new-song-button');
    const statusMessage = document.getElementById('status-message');
    const resultsPanel = document.getElementById('results-panel');
    const songName = document.getElementById('song-name');
    const songDuration = document.getElementById('song-duration');
    const playButton = document.getElementById('play-button');
    const stopButton = document.getElementById('stop-button');
    const masterVolume = document.getElementById('master-volume');
    const masterVolumeValue = document.getElementById('master-volume-value');
    const loopInput = document.getElementById('loop-input');
    const timelineInput = document.getElementById('timeline-input');
    const currentTime = document.getElementById('current-time');
    const totalTime = document.getElementById('total-time');
    const stemGrid = document.getElementById('stem-grid');
    const separatorApiBase = window.STEM_SEPARATOR_API_BASE
        || (/github\.io$/i.test(window.location.hostname)
            ? 'https://aerodynamix20.onrender.com'
            : '');

    function separatorApiUrl(path) {
        if (/^https?:\/\//i.test(path)) return path;
        return `${separatorApiBase}${path.startsWith('/') ? path : `/${path}`}`;
    }

    const state = {
        file: null,
        context: null,
        stems: {},
        sources: {},
        gains: {},
        muted: {},
        offset: 0,
        startedAt: 0,
        playing: false,
        stopping: false,
        animationFrame: null
    };

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '0:00';
        return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
    }

    function setStatus(message, icon = 'circle-info', kind = '') {
        statusMessage.className = `status-message ${kind}`;
        statusMessage.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    }

    function ensureAudio() {
        if (!state.context) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return Promise.reject(new Error('Web Audio is not supported in this browser.'));
            state.context = new AudioContext();
        }
        return state.context.state === 'suspended' ? state.context.resume() : Promise.resolve();
    }

    function duration() {
        return state.stems.vocals?.duration || state.stems.drums?.duration || 0;
    }

    function position() {
        if (!state.playing || !state.context) return state.offset;
        return state.offset + (state.context.currentTime - state.startedAt);
    }

    function updateTimeline() {
        const length = duration();
        let value = position();
        if (loopInput.checked && length) value %= length;
        value = Math.min(Math.max(value, 0), length);
        timelineInput.value = value;
        currentTime.textContent = formatTime(value);
        if (state.playing) state.animationFrame = requestAnimationFrame(updateTimeline);
    }

    function updateGain(stem) {
        if (!state.gains[stem]) return;
        const slider = document.querySelector(`[data-stem-volume="${stem}"]`);
        state.gains[stem].gain.value = state.muted[stem] ? 0 : Number(slider?.value || 80) / 100 * Number(masterVolume.value) / 100;
    }

    function stopSources() {
        Object.values(state.sources).forEach(source => {
            try { source.stop(); } catch (error) { /* already stopped */ }
            try { source.disconnect(); } catch (error) { /* already disconnected */ }
        });
        state.sources = {};
        state.gains = {};
    }

    function updatePlayButton() {
        playButton.classList.toggle('is-playing', state.playing);
        playButton.innerHTML = state.playing
            ? '<i class="fas fa-pause"></i><span>Pause stems</span>'
            : '<i class="fas fa-play"></i><span>Play stems</span>';
    }

    function stopPlayback(reset = false) {
        if (state.playing) {
            state.offset = position();
            if (loopInput.checked && duration()) state.offset %= duration();
        }
        state.stopping = true;
        stopSources();
        state.playing = false;
        state.stopping = false;
        if (reset) state.offset = 0;
        cancelAnimationFrame(state.animationFrame);
        updatePlayButton();
        updateTimeline();
    }

    function startPlayback() {
        if (!Object.keys(state.stems).length || state.playing) return;
        ensureAudio().then(() => {
            state.stopping = false;
            state.startedAt = state.context.currentTime;
            STEMS.forEach(stem => {
                if (!state.stems[stem.id]) return;
                const source = state.context.createBufferSource();
                const gain = state.context.createGain();
                source.buffer = state.stems[stem.id];
                source.loop = loopInput.checked;
                source.connect(gain).connect(state.context.destination);
                state.sources[stem.id] = source;
                state.gains[stem.id] = gain;
                updateGain(stem.id);
                source.start(state.context.currentTime, Math.min(state.offset, source.buffer.duration - 0.001));
            });
            const firstSource = state.sources.vocals || state.sources.drums || state.sources.bass || state.sources.other;
            if (firstSource) {
                firstSource.onended = () => {
                    if (state.stopping || loopInput.checked) return;
                    state.playing = false;
                    state.offset = 0;
                    updatePlayButton();
                    updateTimeline();
                };
            }
            state.playing = true;
            updatePlayButton();
            updateTimeline();
        }).catch(error => setStatus(error.message, 'triangle-exclamation', 'error'));
    }

    function renderStemMixer() {
        stemGrid.innerHTML = '';
        STEMS.forEach(stem => {
            const card = document.createElement('article');
            card.className = 'stem-card';
            card.style.setProperty('--stem-color', stem.color);
            card.innerHTML = `
                <div class="stem-card-heading">
                    <span class="stem-icon"><i class="fas fa-${stem.icon}"></i></span>
                    <div><h3>${stem.label}</h3><span>Separated WAV</span></div>
                    <button class="stem-mute" type="button" data-stem-mute="${stem.id}" aria-label="Mute ${stem.label}"><i class="fas fa-volume-high"></i></button>
                </div>
                <label class="stem-volume" for="stem-volume-${stem.id}"><span>Volume <b data-stem-volume-value="${stem.id}">80%</b></span><input id="stem-volume-${stem.id}" type="range" min="0" max="100" value="80" data-stem-volume="${stem.id}" aria-label="${stem.label} volume"></label>
                <a class="download-stem" data-stem-download="${stem.id}" download="${stem.id}.wav"><i class="fas fa-download"></i> Download</a>
            `;
            const slider = card.querySelector(`[data-stem-volume="${stem.id}"]`);
            slider.addEventListener('input', event => {
                card.querySelector(`[data-stem-volume-value="${stem.id}"]`).textContent = `${event.target.value}%`;
                updateGain(stem.id);
            });
            card.querySelector(`[data-stem-mute="${stem.id}"]`).addEventListener('click', event => {
                state.muted[stem.id] = !state.muted[stem.id];
                event.currentTarget.classList.toggle('is-muted', state.muted[stem.id]);
                event.currentTarget.innerHTML = `<i class="fas fa-volume-${state.muted[stem.id] ? 'xmark' : 'high'}"></i>`;
                updateGain(stem.id);
            });
            stemGrid.appendChild(card);
        });
    }

    async function separateSong() {
        if (!state.file) return;
        stopPlayback(true);
        separateButton.disabled = true;
        separateButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Separating…</span>';
        setStatus('Separating vocals, drums, bass, and other. This can take a few minutes.', 'hourglass-half');
        try {
            const body = new FormData();
            body.append('file', state.file);
            const response = await fetch(separatorApiUrl('/api/beat-separate'), {
                method: 'POST',
                body
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not start stem separation.');
            const job = await waitForSeparation(result.job_id);
            await ensureAudio();
            const decoded = await Promise.all(Object.entries(job.stems).map(async ([stem, url]) => {
                const stemResponse = await fetch(separatorApiUrl(url));
                if (!stemResponse.ok) throw new Error(`Could not load the ${stem} stem.`);
                return [stem, await state.context.decodeAudioData(await stemResponse.arrayBuffer())];
            }));
            state.stems = Object.fromEntries(decoded);
            state.muted = Object.fromEntries(STEMS.map(stem => [stem.id, false]));
            state.offset = 0;
            timelineInput.max = duration();
            totalTime.textContent = formatTime(duration());
            renderStemMixer();
            STEMS.forEach(stem => {
                const link = document.querySelector(`[data-stem-download="${stem.id}"]`);
                if (link && job.stems[stem.id]) link.href = separatorApiUrl(job.stems[stem.id]);
            });
            resultsPanel.hidden = false;
            separateButton.innerHTML = '<i class="fas fa-check"></i><span>Stems ready</span>';
            setStatus('Your four stems are ready to preview, mix, or download.', 'circle-check', 'success');
        } catch (error) {
            separateButton.disabled = false;
            separateButton.innerHTML = '<i class="fas fa-scissors"></i><span>Try again</span>';
            setStatus(error.message, 'triangle-exclamation', 'error');
        }
    }

    async function waitForSeparation(jobId) {
        const startedAt = Date.now();
        const maxWaitMs = 30 * 60 * 1000;
        while (Date.now() - startedAt < maxWaitMs) {
            const response = await fetch(separatorApiUrl(`/api/beat-separate/${encodeURIComponent(jobId)}`), {
                cache: 'no-store'
            });
            const status = await response.json();
            if (!response.ok) throw new Error(status.error || 'Could not check separation status.');
            if (status.status === 'complete') return status;
            if (status.status === 'error') throw new Error(status.error || 'Stem separation failed.');
            setStatus(
                status.status === 'queued'
                    ? 'Your song is queued for the AI separator.'
                    : 'AI separation is still processing. You can keep this page open.',
                status.status === 'queued' ? 'clock' : 'hourglass-half'
            );
            await new Promise(resolve => window.setTimeout(resolve, 2000));
        }
        throw new Error('Stem separation took too long. Try a shorter song.');
    }

    function selectSong(file) {
        if (!file) return;
        state.file = file;
        state.stems = {};
        uploadFileName.textContent = file.name;
        uploadDropzone.classList.add('has-file');
        separateButton.disabled = false;
        separateButton.innerHTML = '<i class="fas fa-scissors"></i><span>Separate stems</span>';
        resultsPanel.hidden = true;
        setStatus('Ready to separate. Your file will be sent only when you click Separate stems.', 'circle-info');
    }

    function reset() {
        stopPlayback(true);
        state.file = null;
        state.stems = {};
        state.muted = {};
        uploadFileName.textContent = '';
        uploadDropzone.classList.remove('has-file');
        separateButton.disabled = true;
        separateButton.innerHTML = '<i class="fas fa-scissors"></i><span>Separate stems</span>';
        resultsPanel.hidden = true;
        songInput.value = '';
        setStatus('Select a song to begin.', 'circle-info');
    }

    songInput.addEventListener('change', () => selectSong(songInput.files[0]));
    separateButton.addEventListener('click', separateSong);
    newSongButton.addEventListener('click', reset);
    playButton.addEventListener('click', () => state.playing ? stopPlayback(false) : startPlayback());
    stopButton.addEventListener('click', () => stopPlayback(true));
    masterVolume.addEventListener('input', () => {
        masterVolumeValue.textContent = `${masterVolume.value}%`;
        STEMS.forEach(stem => updateGain(stem.id));
    });
    loopInput.addEventListener('change', () => {
        if (state.playing) {
            const value = position();
            stopPlayback(false);
            state.offset = value >= duration() ? 0 : value;
            startPlayback();
        }
    });
    timelineInput.addEventListener('input', () => {
        state.offset = Number(timelineInput.value);
        currentTime.textContent = formatTime(state.offset);
        if (state.playing) {
            stopPlayback(false);
            startPlayback();
        }
    });
    uploadDropzone.addEventListener('dragover', event => {
        event.preventDefault();
        uploadDropzone.classList.add('is-dragging');
    });
    uploadDropzone.addEventListener('dragleave', () => uploadDropzone.classList.remove('is-dragging'));
    uploadDropzone.addEventListener('drop', event => {
        event.preventDefault();
        uploadDropzone.classList.remove('is-dragging');
        selectSong(event.dataTransfer.files[0]);
    });
    reset();
})();
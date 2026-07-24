/* ============================================================
   AERODYNAMIX — Shared Music Player
   Persists audio across pages via localStorage.
   Provides `AeroMusic` global API and auto-injects a mini player.
   ============================================================ */
(function () {
    'use strict';

    const LS_KEY = 'aerodynamix-music';
    const LS_PLAYLIST = 'aerodynamix-playlist';
    // Use existing DOM audio element if available (music.html uses audio-player)
    let audio = document.getElementById('audio-player') || document.getElementById('aero-audio');
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'aero-audio';
        audio.preload = 'auto';
        document.body.appendChild(audio);
    }

    let playlist = [];
    let currentIdx = -1;
    let isSeeking = false;
    let lyricLines = [];
    let activeLyricIdx = -1;
    let lyricsVisible = false;
    let lyricsFS = false;
    const LYRICS_CACHE = {};

    /* ─── State helpers ─────────────────────────────────────────── */
    function saveState() {
        // Intentionally left empty — track and timestamp are not saved.
        // Playlist and volume are still saved separately.
    }
    function savePlaylist() {
        localStorage.setItem(LS_PLAYLIST, JSON.stringify(playlist));
    }
    function loadState() {
        // Intentionally left empty — music state does not persist across sessions.
        // The user must manually play a track every time the site loads.
    }

    const isMusicPage = location.pathname.includes('music.html');

    /* ─── Persistence listeners ─────────────────────────────────── */
    audio.addEventListener('play', () => { saveState(); updateMiniPlayer(); });
    audio.addEventListener('pause', () => { saveState(); updateMiniPlayer(); });
    audio.addEventListener('timeupdate', () => {
        if (!isSeeking) {
            const pct = (audio.currentTime / audio.duration) * 100 || 0;
            const el = document.getElementById('mini-seek');
            if (el) el.value = pct;
        }
        const timeEl = document.getElementById('mini-time');
        if (timeEl) timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
        // Only update lyrics on mini player if music page doesn't have its own panel
        if (!document.getElementById('lyrics-panel')) {
            updateActiveLyric(audio.currentTime);
        }
        // save currentTime every 2s
        if (Math.floor(audio.currentTime) % 2 === 0) saveState();
    });
    if (!isMusicPage) {
        audio.addEventListener('ended', () => {
            if (currentIdx < playlist.length - 1) {
                setTrackByIdx(currentIdx + 1);
            } else {
                saveState();
            }
        });
    }
    window.addEventListener('pagehide', saveState);
    window.addEventListener('beforeunload', saveState);

    /* ─── Seek logic ────────────────────────────────────────────── */
    function initSeek() {
        const slider = document.getElementById('mini-seek');
        if (!slider) return;
        slider.addEventListener('mousedown', () => { isSeeking = true; });
        slider.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
        const commit = () => {
            if (!isNaN(audio.duration) && audio.duration > 0) {
                audio.currentTime = (slider.value / 100) * audio.duration;
            }
        };
        slider.addEventListener('change', commit);
        slider.addEventListener('touchend', commit);
        audio.addEventListener('seeked', () => { isSeeking = false; });
        document.addEventListener('mouseup', () => {
            if (isSeeking && !audio.seeking) isSeeking = false;
        });
    }

    /* ─── Core API ──────────────────────────────────────────────── */
    function setTrackByIdx(idx) {
        if (idx < 0 || idx >= playlist.length) return;
        currentIdx = idx;
        const t = playlist[idx];
        setTrack(t.src, t.title, t.album, t.art);
    }

    function setTrack(src, title, album, art) {
        audio.pause();
        audio.src = src;
        audio.dataset.title = title || '';
        audio.dataset.album = album || '';
        audio.dataset.art = art || '';
        audio.addEventListener('canplay', function onReady() {
            audio.removeEventListener('canplay', onReady);
            audio.play().catch(e => console.warn('Autoplay blocked:', e));
        });
        audio.load();
        saveState();
        updateMiniPlayer();
        loadLyrics(src, title, album);
    }

    function setTrackList(tracks) {
        playlist = tracks || [];
        currentIdx = playlist.findIndex(t => t.src === audio.src);
        savePlaylist();
    }

    function togglePlayPause() {
        if (audio.paused) audio.play(); else audio.pause();
    }

    function prevTrack() {
        if (currentIdx > 0) setTrackByIdx(currentIdx - 1);
    }

    function nextTrack() {
        if (currentIdx < playlist.length - 1) setTrackByIdx(currentIdx + 1);
    }

    function setVolume(val) {
        audio.volume = val;
        const el = document.getElementById('mini-vol');
        if (el) el.value = val;
        saveState();
    }

    function doSeek(pct) {
        if (!isNaN(audio.duration) && audio.duration > 0) {
            audio.currentTime = (pct / 100) * audio.duration;
        }
    }

    function stop() {
        audio.pause();
        audio.src = '';
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_PLAYLIST);
        updateMiniPlayer();
    }

    /* ─── Mini Player UI ────────────────────────────────────────── */
    function createMiniPlayer() {
        if (document.getElementById('mini-player') || document.getElementById('game-footer') || document.getElementById('media-player')) return;
        const bar = document.createElement('div');
        bar.id = 'mini-player';
        bar.innerHTML = `
            <div class="mini-inner">
                <div class="mini-left">
                    <img id="mini-art" src="images/music/yeezus.jpg" alt="" style="opacity:0.3">
                    <div class="mini-meta">
                        <div class="mini-track" id="mini-track">—</div>
                        <div class="mini-album" id="mini-album">—</div>
                    </div>
                </div>
                <div class="mini-center">
                    <button class="mini-btn" id="mini-prev" title="Previous"><i class="fa-solid fa-backward-step"></i></button>
                    <button class="mini-btn play-pause" id="mini-play" title="Play/Pause"><i class="fa-solid fa-play"></i></button>
                    <button class="mini-btn" id="mini-next" title="Next"><i class="fa-solid fa-forward-step"></i></button>
                </div>
                <div class="mini-right">
                    <span class="mini-time" id="mini-time">0:00 / 0:00</span>
                    <input type="range" id="mini-seek" min="0" max="100" step="0.1" value="0">
                    <i class="fa-solid fa-volume-low mini-vol-icon"></i>
                    <input type="range" id="mini-vol" min="0" max="1" step="0.01" value="1">
                    <button class="mini-btn" id="mini-lyrics" title="Lyrics" style="font-size:0.8rem;padding:6px 10px;border-radius:6px;border:1px solid #444;background:transparent;color:#aaa;transition:all 0.2s;"><i class="fa-solid fa-microphone-lines"></i></button>
                    <button class="mini-btn" id="mini-close" title="Stop"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div id="mini-lyrics-panel" class="mini-lyrics">
                <div class="mini-lyrics-header">
                    <span id="mini-lyrics-title">Lyrics</span>
                    <button class="mini-lyrics-ctrl" id="mini-lyrics-fs" title="Fullscreen"><i class="fa-solid fa-expand"></i></button>
                    <button class="mini-lyrics-ctrl" id="mini-lyrics-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="mini-lyrics-body" id="mini-lyrics-body">
                    <p style="color:#555;text-align:center;margin-top:40px;font-size:0.85rem;">Play a track to see lyrics</p>
                </div>
            </div>
        `;
        document.body.appendChild(bar);
        initSeek();
        bindMiniControls();
        initMiniLyricsDrag();
    }

    function bindMiniControls() {
        document.getElementById('mini-prev').onclick = prevTrack;
        document.getElementById('mini-play').onclick = togglePlayPause;
        document.getElementById('mini-next').onclick = nextTrack;
        document.getElementById('mini-vol').oninput = function () { setVolume(this.value); };
        document.getElementById('mini-close').onclick = stop;
        document.getElementById('mini-lyrics').onclick = toggleMiniLyrics;
        document.getElementById('mini-lyrics-close').onclick = toggleMiniLyrics;
        document.getElementById('mini-lyrics-fs').onclick = toggleMiniLyricsFullscreen;
    }

    function updateMiniPlayer() {
        const bar = document.getElementById('mini-player');
        if (!bar) return;
        const hasSrc = audio.src && audio.src !== window.location.href;
        const isPlaying = !audio.paused;
        if (!hasSrc || !isPlaying) {
            bar.classList.remove('visible');
            document.body.classList.remove('mini-player-active');
            return;
        }
        // Don't show mini-player on the password overlay
        const overlay = document.getElementById('key-overlay');
        if (overlay && overlay.style.display !== 'none') {
            bar.classList.remove('visible');
            document.body.classList.remove('mini-player-active');
            return;
        }
        bar.classList.add('visible');
        document.body.classList.add('mini-player-active');
        const art = document.getElementById('mini-art');
        if (art) {
            art.src = audio.dataset.art || '';
            art.style.display = 'block';
            art.classList.toggle('active', !!audio.dataset.art && audio.dataset.art !== '');
        }
        document.getElementById('mini-track').textContent = audio.dataset.title || '—';
        document.getElementById('mini-album').textContent = audio.dataset.album || '—';
        const playIcon = document.getElementById('mini-play').querySelector('i');
        playIcon.className = audio.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    }

    /* ─── Lyrics (mini version) ─────────────────────────────────── */
    function parseLRC(lrc) {
        const result = [];
        for (const line of lrc.split('\n')) {
            const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
            if (m) {
                const t = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
                result.push([t, m[3].trim()]);
            }
        }
        return result;
    }
    async function fetchLyrics(title, album) {
        const key = title + '::' + album;
        if (LYRICS_CACHE[key] !== undefined) return LYRICS_CACHE[key];

        async function tryQuery(params) {
            const url = 'https://lrclib.net/api/get?' + new URLSearchParams(params);
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            if (data.syncedLyrics) return parseLRC(data.syncedLyrics);
            if (data.plainLyrics) return data.plainLyrics.split('\n').map(l => [0, l]);
            return null;
        }

        let lines = null;
        try {
            lines = await tryQuery({ artist_name: 'Kanye West', track_name: title, album_name: album });
            if (!lines) {
                lines = await tryQuery({ artist_name: 'Kanye West', track_name: title });
            }
        } catch (e) { lines = null; }

        LYRICS_CACHE[key] = lines;
        return lines;
    }
    async function loadLyrics(src, title, album) {
        const body = document.getElementById('mini-lyrics-body');
        if (!body) return;
        document.getElementById('mini-lyrics-title').textContent = (title || 'Lyrics') + ' — Lyrics';
        activeLyricIdx = -1;
        body.innerHTML = '<p style="color:#555;text-align:center;margin-top:40px;font-size:0.85rem;">Loading lyrics…</p>';
        const lines = await fetchLyrics(title, album);
        if (!lines || !lines.length) {
            body.innerHTML = '<p style="color:#555;text-align:center;margin-top:40px;font-size:0.85rem;">No lyrics available</p>';
            lyricLines = [];
            return;
        }
        lyricLines = lines;
        body.innerHTML = lines.map((entry, i) => {
            const text = entry[1];
            if (!text) return `<div class="mini-lyric-line" data-idx="${i}" data-t="${entry[0]}" style="height:12px;"></div>`;
            return `<div class="mini-lyric-line" data-idx="${i}" data-t="${entry[0]}" onclick="AeroMusic.seekToLyric(${entry[0]})">${text}</div>`;
        }).join('');
    }
    function updateActiveLyric(t) {
        const body = document.getElementById('mini-lyrics-body');
        if (!body || !lyricLines.length) return;
        const lines = body.querySelectorAll('.mini-lyric-line[data-t]');
        if (!lines.length) return;
        let activeIdx = -1;
        lines.forEach((el, i) => {
            const lt = parseFloat(el.dataset.t);
            if (t >= lt) activeIdx = i;
        });
        if (activeIdx === activeLyricIdx) return;
        activeLyricIdx = activeIdx;
        lines.forEach((el, i) => {
            el.classList.remove('active', 'near');
            if (i === activeIdx) el.classList.add('active');
            else if (Math.abs(i - activeIdx) <= 1) el.classList.add('near');
        });
        if (activeIdx >= 0) {
            const activeEl = lines[activeIdx];
            const bRect = body.getBoundingClientRect();
            const eRect = activeEl.getBoundingClientRect();
            const offset = eRect.top - bRect.top - bRect.height / 2 + eRect.height / 2;
            body.scrollBy({ top: offset, behavior: 'smooth' });
        }
    }
    function seekToLyric(t) {
        if (!isNaN(audio.duration)) {
            audio.currentTime = t;
            if (audio.paused) audio.play().catch(() => {});
        }
    }
    function toggleMiniLyrics() {
        const panel = document.getElementById('mini-lyrics-panel');
        if (!panel) return;
        lyricsVisible = !lyricsVisible;
        panel.classList.toggle('visible', lyricsVisible);
        const btn = document.getElementById('mini-lyrics');
        if (btn) {
            btn.style.color = lyricsVisible ? '#fff' : '#aaa';
            btn.style.borderColor = lyricsVisible ? '#fff' : '#444';
        }
    }
    function toggleMiniLyricsFullscreen() {
        const panel = document.getElementById('mini-lyrics-panel');
        if (!panel) return;
        lyricsFS = !lyricsFS;
        panel.classList.toggle('fullscreen', lyricsFS);
        const icon = document.getElementById('mini-lyrics-fs').querySelector('i');
        icon.className = lyricsFS ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        if (!lyricsFS) {
            panel.style.left = ''; panel.style.top = ''; panel.style.transform = '';
        }
    }
    function initMiniLyricsDrag() {
        const header = document.querySelector('#mini-lyrics-panel .mini-lyrics-header');
        const panel = document.getElementById('mini-lyrics-panel');
        if (!header || !panel) return;
        let dragging = false, startX, startY, origLeft, origTop;
        header.addEventListener('mousedown', e => {
            if (lyricsFS) return;
            dragging = true;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX; startY = e.clientY;
            origLeft = rect.left; origTop = rect.top;
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
            panel.style.left = origLeft + 'px'; panel.style.top = origTop + 'px';
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            panel.style.left = (origLeft + e.clientX - startX) + 'px';
            panel.style.top = (origTop + e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', () => {
            dragging = false; document.body.style.userSelect = '';
        });
    }

    function formatTime(s) {
        if (isNaN(s) || s < 0) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    }

    /* ─── Inject mini player CSS ────────────────────────────────── */
    function injectMiniCSS() {
        if (document.getElementById('mini-css')) return;
        const style = document.createElement('style');
        style.id = 'mini-css';
        style.textContent = `
            #mini-player {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 10000;
                background: rgba(10,10,10,0.97);
                backdrop-filter: blur(20px);
                border-top: 1px solid #222;
                padding: 12px 30px;
                display: none;
                align-items: center;
                gap: 20px;
                transform: translateY(0);
                transition: transform 0.3s ease;
                font-family: 'Montserrat', sans-serif;
            }
            #mini-player.visible { display: flex; }
            body.mini-player-active {
                padding-bottom: 72px !important;
            }
            #mini-player .mini-inner {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                width: 100%;
                max-width: 1200px;
                margin: 0 auto;
            }
            #mini-player .mini-left {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
                flex-shrink: 0;
                width: 220px;
            }
            #mini-player .mini-left img {
                width: 52px; height: 52px; border-radius: 6px; object-fit: cover;
                background: #222; flex-shrink: 0; opacity: 0.3;
                transition: opacity 0.3s;
            }
            #mini-player .mini-left img.active { opacity: 1; }
            #mini-player .mini-meta {
                min-width: 0;
                overflow: hidden;
            }
            #mini-player .mini-track {
                font-size: 0.85rem; font-weight: 700; color: #fff;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            #mini-player .mini-album {
                font-size: 0.72rem; color: #888;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            #mini-player .mini-center {
                display: flex; align-items: center; gap: 18px;
                flex-shrink: 0;
            }
            #mini-player .mini-btn {
                background: none; border: none;
                color: #ccc; border-radius: 5px; cursor: pointer;
                padding: 4px 8px; font-size: 1.1rem;
                transition: all 0.2s; display: inline-flex; align-items: center;
                justify-content: center;
            }
            #mini-player .mini-btn:hover { color: #fff; }
            #mini-player .mini-btn.play-pause {
                width: 38px; height: 38px; border-radius: 50%;
                background: #fff; color: #000;
                display: flex; align-items: center; justify-content: center;
                font-size: 1rem;
            }
            #mini-player .mini-btn.play-pause:hover { background: #ddd; }
            #mini-player .mini-right {
                display: flex; align-items: center; gap: 12px;
                flex: 1;
                justify-content: flex-end;
                min-width: 0;
            }
            #mini-player input[type="range"] {
                -webkit-appearance: none;
                appearance: none;
                height: 4px;
                background: #333;
                border-radius: 2px;
                cursor: pointer;
                outline: none;
            }
            #mini-player input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 10px; height: 10px;
                background: #fff; border-radius: 50%;
            }
            #mini-player #mini-seek { width: 120px; }
            #mini-player #mini-vol { width: 60px; }
            #mini-player .mini-time {
                font-size: 0.72rem; color: #888; white-space: nowrap;
            }
            #mini-player .mini-vol-icon {
                font-size: 0.75rem; color: #888;
            }
            #mini-lyrics-panel {
                position: absolute;
                bottom: 50px;
                right: 10px;
                width: 320px;
                height: 260px;
                background: #111;
                border: 1px solid #333;
                border-radius: 8px;
                z-index: 10000;
                display: none;
                flex-direction: column;
                overflow: hidden;
            }
            #mini-lyrics-panel.visible { display: flex; }
            #mini-lyrics-panel.fullscreen {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                width: 100%; height: 100%;
                border-radius: 0;
                z-index: 10001;
            }
            .mini-lyrics-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 8px 12px;
                background: #1a1a1a;
                border-bottom: 1px solid #333;
                cursor: grab;
                font-size: 0.85rem;
                font-weight: 600;
            }
            .mini-lyrics-ctrl {
                background: transparent; border: none; color: #aaa;
                cursor: pointer; font-size: 0.75rem;
            }
            .mini-lyrics-body {
                flex: 1;
                overflow-y: auto;
                padding: 10px 14px;
                font-size: 0.85rem;
                line-height: 1.6;
                color: #ccc;
            }
            .mini-lyrics-body .mini-lyric-line {
                padding: 3px 0;
                transition: color 0.2s;
                cursor: pointer;
                opacity: 0.6;
            }
            .mini-lyrics-body .mini-lyric-line.active {
                color: #fff; font-weight: 600; opacity: 1;
                font-size: 0.95rem;
            }
            .mini-lyrics-body .mini-lyric-line.near { opacity: 0.85; }
            .mini-lyrics-body .mini-lyric-line:hover { opacity: 1; }
            @media (max-width: 600px) {
                #mini-player .mini-inner { flex-wrap: wrap; }
                #mini-player .mini-right { order: 3; width: 100%; justify-content: center; }
                #mini-player #mini-seek { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    /* ─── Auto init ─────────────────────────────────────────────── */
    function init() {
        injectMiniCSS();
        createMiniPlayer();
        // Wipe any legacy saved playback state so nothing auto-plays
        localStorage.removeItem(LS_KEY);
        loadState();
        // Do NOT attempt autoplay — music must be started manually every session
        // Watch for password overlay being hidden so mini-player can appear
        const overlay = document.getElementById('key-overlay');
        if (overlay) {
            const observer = new MutationObserver(() => {
                if (overlay.style.display === 'none') {
                    updateMiniPlayer();
                } else {
                    const bar = document.getElementById('mini-player');
                    if (bar) bar.classList.remove('visible');
                }
            });
            observer.observe(overlay, { attributes: true, attributeFilter: ['style'] });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ─── Expose global API ─────────────────────────────────────── */
    window.AeroMusic = {
        setTrack, setTrackList, togglePlayPause, prevTrack, nextTrack,
        setVolume, doSeek, stop, getState: () => {
            return {
                src: audio.src, title: audio.dataset.title, album: audio.dataset.album,
                art: audio.dataset.art, currentTime: audio.currentTime, duration: audio.duration,
                volume: audio.volume,
                playing: !audio.paused, playlist, currentIdx
            };
        },
        seekToLyric, toggleMiniLyrics, toggleMiniLyricsFullscreen
    };

})();

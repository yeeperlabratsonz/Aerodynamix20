/* Aerodynamix - Unified Auth Gate */
(function() {
    'use strict';

    function isAuthorized() { return sessionStorage.getItem('authorized') === 'true'; }
    function isTrialActive() { return !!sessionStorage.getItem('trial_start') && !isAuthorized(); }
    function trialUsed() { return sessionStorage.getItem('trial_used') === 'true'; }

    // Already authorized — just dispatch event and let page load normally
    if (isAuthorized()) {
        window.dispatchEvent(new CustomEvent('aerodynamixAuthorized'));
        return;
    }

    // Trial already in progress on this page load
    if (isTrialActive()) {
        sessionStorage.setItem('trial_used', 'true');
        injectTrialTimer();
        // Reveal content that would normally be shown after dismissing the overlay
        const msg = document.getElementById('no-games-msg');
        if (msg) msg.style.display = 'none';
        const games = document.getElementById('games');
        if (games) games.classList.add('revealed');
        document.body.style.overflow = '';
        window.dispatchEvent(new CustomEvent('aerodynamixAuthorized'));
        window.dispatchEvent(new CustomEvent('aerodynamixTrialActive'));
        return;
    }

    // If trial was used in this session and not authorized, show password screen again
    if (trialUsed()) {
        injectOverlay();
        return;
    }

    // Otherwise: show password overlay
    injectStyles();
    injectOverlay();

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #key-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(ellipse at 50% 120%, rgba(44,127,252,0.18) 0%, transparent 55%), #030509;
                z-index: 9999;
                display: flex; align-items: center; justify-content: center; flex-direction: column;
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
            }
            .key-card {
                text-align: center;
                background: rgba(10, 14, 24, 0.85);
                padding: 52px 56px 44px;
                border-radius: 22px;
                border: 1px solid rgba(44,127,252,0.22);
                box-shadow: 0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(44,127,252,0.08), inset 0 1px 0 rgba(255,255,255,0.06);
                backdrop-filter: blur(20px);
                max-width: 400px;
                width: 90%;
                box-sizing: border-box;
            }
            .key-logo { width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 22px; display: block; box-shadow: 0 8px 28px rgba(44,127,252,0.35); }
            .key-title { margin: 0 0 6px; font-size: 1.45rem; font-weight: 700; color: #fff; letter-spacing: 0.32em; text-indent: 0.32em; }
            .key-sub { margin: 0 0 30px; font-size: 0.8rem; font-weight: 400; color: rgba(255,255,255,0.45); letter-spacing: 0.08em; }
            .key-input-wrap { position: relative; width: 100%; margin: 0 auto; }
            #game-key-input {
                width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
                border-radius: 12px; color: #fff; padding: 15px 74px 15px 18px; font-size: 1rem;
                letter-spacing: 0.15em; outline: none; box-sizing: border-box;
                transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
                font-family: inherit;
            }
            #game-key-input::placeholder { color: rgba(255,255,255,0.25); letter-spacing: 0.05em; }
            #game-key-input:focus { border-color: rgba(44,127,252,0.65); box-shadow: 0 0 0 4px rgba(44,127,252,0.12), 0 0 24px rgba(44,127,252,0.15); background: rgba(44,127,252,0.05); }
            #toggle-password {
                position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
                background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; color: rgba(255,255,255,0.55); padding: 6px 12px; cursor: pointer;
                font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em;
                user-select: none; transition: all 0.2s ease; font-family: inherit;
            }
            #toggle-password:hover { color: #fff; background: rgba(44,127,252,0.2); border-color: rgba(44,127,252,0.4); }
            #submit-key {
                margin-top: 22px; width: 100%;
                background: linear-gradient(135deg, #2c7ffc 0%, #1a5fd0 100%);
                border: none; border-radius: 12px; color: #fff; padding: 15px 0;
                font-size: 0.95rem; font-weight: 600; letter-spacing: 0.22em; text-indent: 0.22em;
                cursor: pointer; transition: all 0.25s ease; font-family: inherit; text-transform: uppercase;
                box-shadow: 0 10px 30px rgba(44,127,252,0.35);
            }
            #submit-key:hover { transform: translateY(-1px); box-shadow: 0 14px 40px rgba(44,127,252,0.5); filter: brightness(1.1); }
            #submit-key:active { transform: translateY(0); filter: brightness(0.95); }
            #error-msg { color: #ff5b6a; margin: 16px 0 0; display: none; font-weight: 500; font-size: 0.82rem; letter-spacing: 0.05em; }

            #trial-timer {
                position: fixed; top: 10px; right: 10px;
                background: rgba(10,14,24,0.9); color: #7eb8ff;
                padding: 10px 20px; border: 1px solid rgba(44,127,252,0.4);
                border-radius: 10px; font-family: 'Segoe UI', Arial, sans-serif;
                z-index: 10000; display: none; font-weight: 600; letter-spacing: 0.05em;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(44,127,252,0.15);
            }
            #auth-lockout {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: #030509; z-index: 99999;
                display: flex; align-items: center; justify-content: center; flex-direction: column;
                color: rgba(255,255,255,0.5); font-family: 'Segoe UI', Arial, sans-serif;
                text-align: center; padding: 20px;
            }
            #auth-lockout h2 { color: #fff; font-size: 1.8rem; font-weight: 700; letter-spacing: 0.2em; margin-bottom: 12px; }
            #auth-lockout p { font-size: 0.9rem; letter-spacing: 0.05em; max-width: 400px; }
        `;
        document.head.appendChild(style);
    }

    function injectOverlay() {
        document.body.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.id = 'key-overlay';
        overlay.innerHTML = `
            <div class="key-card">
                <img src="images/logo.gif" alt="" class="key-logo">
                <h1 class="key-title">AERODYNAMIX</h1>
                <p class="key-sub">Enter your access key to continue</p>
                <div class="key-input-wrap">
                    <input type="password" id="game-key-input" placeholder="Access key" autocomplete="off">
                    <button id="toggle-password">SHOW</button>
                </div>
                <button id="submit-key">Unlock</button>
                <p id="error-msg">ACCESS DENIED</p>
            </div>
        `;
        document.body.appendChild(overlay);

        // Trial timer (hidden by default)
        const timer = document.createElement('div');
        timer.id = 'trial-timer';
        timer.innerHTML = 'TRIAL TIME: <span id="time-left">05:00</span>';
        document.body.appendChild(timer);

        const input = document.getElementById('game-key-input');
        const button = document.getElementById('submit-key');
        const toggleBtn = document.getElementById('toggle-password');
        const error = document.getElementById('error-msg');
        const timerDisplay = document.getElementById('trial-timer');
        const timeLeftSpan = document.getElementById('time-left');
        const validKey = atob('U2Vld2l0aHlvdXJtaW5kNjY2JA==').trim();
        const trialKey = atob('ZnJlZXRyaWFs');

        toggleBtn.addEventListener('mousedown', () => input.type = 'text');
        toggleBtn.addEventListener('mouseup', () => input.type = 'password');
        toggleBtn.addEventListener('mouseleave', () => input.type = 'password');
        toggleBtn.addEventListener('touchstart', (e) => { e.preventDefault(); input.type = 'text'; });
        toggleBtn.addEventListener('touchend', () => input.type = 'password');

        let snitchCount = 0;
        function checkKey() {
            const val = input.value.trim();
            if (val === 'snitch') {
                snitchCount++;
                input.value = '';
                if (snitchCount >= 3) { window.location.href = 'https://www.google.com/search?q=stop'; return; }
                return;
            } else { snitchCount = 0; }

            if (val === 'alannah') {
                error.innerText = 'sigh, she was annoying'; error.className = ''; error.style.display = 'block'; input.value = ''; return;
            } else if (val.toLowerCase() === 'bill cipher' || val.toLowerCase() === 'billcipher') {
                error.innerText = 'Reality is an illusion, The universe is a hologram, buy gold, bye!';
                error.className = 'rainbow-text'; error.style.display = 'block'; input.value = ''; return;
            } else if (val === validKey || val.toLowerCase() === validKey.toLowerCase()) {
                sessionStorage.setItem('authorized', 'true');
                dismissOverlay();
                (function tryApply() {
                    if (typeof applyTheme === 'function') {
                        applyTheme('black');
                        window.dispatchEvent(new CustomEvent('aerodynamixAuthorized'));
                    } else { setTimeout(tryApply, 80); }
                })();
                if (window.AeroBootScreen && (window.location.pathname === '/' || window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html'))) AeroBootScreen.show();
            } else if (val === trialKey) {
                if (trialUsed()) {
                    error.innerText = 'Free Trial Cannot Be Used Again'; error.className = ''; error.style.display = 'block'; input.value = '';
                } else { startTrial(); }
            } else {
                error.innerText = val.length === validKey.length ? 'Incorrect access key' : 'Incorrect access key (' + val.length + '/' + validKey.length + ')';
                error.className = ''; error.style.display = 'block'; input.value = '';
            }
        }

        function dismissOverlay() {
            overlay.remove();
            timerDisplay.style.display = 'none';
            const msg = document.getElementById('no-games-msg');
            if (msg) msg.style.display = 'none';
            const oldGames = document.getElementById('games');
            if (oldGames) {
                const parent = oldGames.parentElement;
                const newGames = oldGames.cloneNode(true);
                newGames.classList.add('revealed');
                parent.replaceChild(newGames, oldGames);
            }
            document.body.style.overflow = '';
        }

        function startTrial() {
            dismissOverlay();
            sessionStorage.setItem('trial_used', 'true');
            timerDisplay.style.display = 'block';
            let startTime = sessionStorage.getItem('trial_start');
            if (!startTime) { startTime = Date.now().toString(); sessionStorage.setItem('trial_start', startTime); }
            const startTimestamp = parseInt(startTime);
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - startTimestamp) / 1000);
                let timeLeft = 300 - elapsed;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    sessionStorage.removeItem('trial_start');
                    timerDisplay.style.display = 'none';
                    injectOverlay();
                } else {
                    const mins = Math.floor(timeLeft / 60);
                    const secs = timeLeft % 60;
                    timeLeftSpan.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
                }
            }, 1000);
        }

        button.addEventListener('click', checkKey);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkKey(); } });
    }

    function injectTrialTimer() {
        const timer = document.createElement('div');
        timer.id = 'trial-timer';
        timer.style.cssText = `
            position: fixed; top: 10px; right: 10px;
            background: rgba(10,14,24,0.9); color: #7eb8ff;
            padding: 10px 20px; border: 1px solid rgba(44,127,252,0.4);
            border-radius: 10px; font-family: 'Segoe UI', Arial, sans-serif;
            z-index: 10000; font-weight: 600; letter-spacing: 0.05em;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(44,127,252,0.15);
        `;
        timer.innerHTML = 'TRIAL TIME: <span id="time-left">05:00</span>';
        document.body.appendChild(timer);

        const timeLeftSpan = document.getElementById('time-left');
        const startTimestamp = parseInt(sessionStorage.getItem('trial_start'));
        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = Math.floor((now - startTimestamp) / 1000);
            let timeLeft = 300 - elapsed;
            if (timeLeft <= 0) {
                clearInterval(interval);
                sessionStorage.removeItem('trial_start');
                timer.remove();
                injectOverlay();
            } else {
                const mins = Math.floor(timeLeft / 60);
                const secs = timeLeft % 60;
                timeLeftSpan.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
            }
        }, 1000);
    }

})();

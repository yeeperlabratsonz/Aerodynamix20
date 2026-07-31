/* Aerodynamix Boot Screen */
(function() {
    'use strict';

    const SESSION_KEY = 'aerodynamix_booted';

    function hasExperienceAccess() {
        return sessionStorage.getItem('authorized') === 'true' ||
            sessionStorage.getItem('free_trial') === 'true';
    }

    function alreadyBooted() {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    }

    function markBooted() {
        sessionStorage.setItem(SESSION_KEY, 'true');
    }

    function createBootScreen() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes aero-fade-up {
                0%   { opacity: 0; transform: translateY(18px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes aero-logo-reveal {
                0%   { opacity: 0; transform: scale(0.92); filter: blur(10px); }
                100% { opacity: 1; transform: scale(1); filter: blur(0); }
            }
            @keyframes aero-track-in {
                0%   { opacity: 0; }
                100% { opacity: 1; }
            }
            @keyframes aero-title-track {
                0%   { opacity: 0; letter-spacing: 0.7em; filter: blur(8px); }
                100% { opacity: 1; letter-spacing: 0.28em; filter: blur(0); }
            }
            @keyframes aero-line-grow {
                0%   { transform: scaleX(0); }
                100% { transform: scaleX(1); }
            }
            @keyframes aero-sub-reveal {
                0%   { opacity: 0; letter-spacing: 0.55em; }
                100% { opacity: 0.55; letter-spacing: 0.42em; }
            }
            @keyframes aero-progress-fill {
                0%   { width: 0%; }
                100% { width: 100%; }
            }
            @keyframes aero-shimmer {
                0%   { background-position: -200% center; }
                100% { background-position: 200% center; }
            }
            @keyframes aero-glow-breathe {
                0%, 100% { opacity: 0.35; transform: translate(-50%, -50%) scale(1); }
                50%       { opacity: 0.55; transform: translate(-50%, -50%) scale(1.15); }
            }
            @keyframes aero-boot-out {
                0%   { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'aero-boot-screen';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(ellipse at 50% 115%, rgba(44,127,252,0.14) 0%, transparent 55%), #020409;
            z-index: 99999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
            overflow: hidden;
        `;

        // Ambient glow behind everything
        const glow = document.createElement('div');
        glow.style.cssText = `
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 560px; height: 560px; border-radius: 50%;
            background: radial-gradient(circle, rgba(44,127,252,0.12) 0%, transparent 65%);
            animation: aero-glow-breathe 4s ease-in-out infinite;
            pointer-events: none;
        `;
        overlay.appendChild(glow);

        // Logo — soft, elegant reveal
        const logo = document.createElement('img');
        logo.src = 'images/logo.gif';
        logo.style.cssText = `
            width: 92px; height: 92px; border-radius: 22px;
            display: block; object-fit: cover;
            margin-bottom: 36px;
            box-shadow: 0 20px 60px rgba(44,127,252,0.35), 0 0 0 1px rgba(255,255,255,0.06);
            animation: aero-logo-reveal 1.1s cubic-bezier(0.22,1,0.36,1) 0.2s both;
            z-index: 2;
        `;
        overlay.appendChild(logo);

        // Title — wide tracking easing in, with a subtle shimmer sweep
        const title = document.createElement('div');
        title.textContent = 'AERODYNAMIX';
        title.style.cssText = `
            z-index: 2;
            font-size: clamp(1.6rem, 4.2vw, 2.9rem);
            font-weight: 300;
            color: transparent;
            letter-spacing: 0.28em;
            text-indent: 0.28em;
            background: linear-gradient(100deg,
                #ffffff 0%, #ffffff 42%,
                #9ec8ff 50%,
                #ffffff 58%, #ffffff 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            background-clip: text;
            animation: aero-title-track 1.3s cubic-bezier(0.22,1,0.36,1) 0.9s both,
                       aero-shimmer 2.8s linear 2.2s infinite;
            margin-bottom: 26px;
        `;
        overlay.appendChild(title);

        // Thin divider line growing from center
        const divider = document.createElement('div');
        divider.style.cssText = `
            z-index: 2;
            width: clamp(180px, 30vw, 320px);
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(44,127,252,0.8), transparent);
            transform-origin: center;
            animation: aero-line-grow 1.0s cubic-bezier(0.22,1,0.36,1) 1.7s both;
            margin-bottom: 26px;
        `;
        overlay.appendChild(divider);

        // Subtitle — luxury positioning
        const subtitle = document.createElement('div');
        subtitle.textContent = 'PRIVATE MEDIA COLLECTION';
        subtitle.style.cssText = `
            z-index: 2;
            font-size: clamp(0.58rem, 1.3vw, 0.78rem);
            font-weight: 500;
            color: rgba(255,255,255,0.55);
            letter-spacing: 0.42em;
            text-indent: 0.42em;
            animation: aero-sub-reveal 1.1s ease-out 2.2s both;
            margin-bottom: 64px;
        `;
        overlay.appendChild(subtitle);

        // Minimal progress line
        const track = document.createElement('div');
        track.style.cssText = `
            z-index: 2;
            width: clamp(160px, 24vw, 260px);
            height: 2px;
            background: rgba(255,255,255,0.08);
            border-radius: 1px;
            overflow: hidden;
            animation: aero-track-in 0.6s ease-out 2.6s both;
        `;
        const fill = document.createElement('div');
        fill.style.cssText = `
            height: 100%; width: 0%;
            background: linear-gradient(90deg, #2c7ffc, #9ec8ff);
            border-radius: 1px;
            animation: aero-progress-fill 1.4s cubic-bezier(0.65,0,0.35,1) 2.8s both;
        `;
        track.appendChild(fill);
        overlay.appendChild(track);

        // Welcome word — appears last, quiet confidence
        const welcome = document.createElement('div');
        welcome.textContent = 'WELCOME';
        welcome.style.cssText = `
            z-index: 2;
            position: absolute;
            bottom: 8%;
            font-size: 0.6rem;
            font-weight: 600;
            color: rgba(158,200,255,0.5);
            letter-spacing: 0.5em;
            text-indent: 0.5em;
            animation: aero-fade-up 0.8s ease-out 3.6s both;
        `;
        overlay.appendChild(welcome);

        document.body.appendChild(overlay);

        // Graceful exit
        const totalDuration = 4600; // ms
        setTimeout(() => {
            overlay.style.animation = 'aero-boot-out 0.9s ease forwards';
            setTimeout(() => overlay.remove(), 950);
        }, totalDuration);
    }

    window.AeroBootScreen = {
        show: function() {
            if (!hasExperienceAccess()) return;
            if (alreadyBooted()) return;
            markBooted();
            createBootScreen();
        }
    };

    window.addEventListener('aerodynamixAuthorized', function() {
        window.AeroBootScreen.show();
    });

})();

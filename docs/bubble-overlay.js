/* Aerodynamix - Frutiger Aero Bubble Overlay */
(function() {
    'use strict';
    const BUBBLE_INTERVAL = 500; // spawn a bubble every ~500ms
    const MAX_BUBBLES = 30;
    const BUBBLE_MIN_SIZE = 20;
    const BUBBLE_MAX_SIZE = 70;
    const FALL_SPEED_MIN = 2000; // ms
    const FALL_SPEED_MAX = 7000;
    let bubbleContainer = null;
    let spawnTimer = null;
    let running = false;
    let bubbles = [];

    function isGamePage() {
        return window.location.pathname.includes('game-frame');
    }

    function getTheme() {
        try {
            if (sessionStorage.getItem('authorized') !== 'true') return 'black';
            return localStorage.getItem('aerodynamixTheme') || 'black';
        } catch (e) { return 'black'; }
    }

    function createBubble() {
        if (isLiteMode()) return;
        if (bubbles.length >= MAX_BUBBLES) return;
        const size = BUBBLE_MIN_SIZE + Math.random() * (BUBBLE_MAX_SIZE - BUBBLE_MIN_SIZE);
        const bubble = document.createElement('div');
        bubble.style.cssText = `
            position:fixed;
            left:${Math.random() * 95}vw;
            top:-${size + 10}px;
            width:${size}px;
            height:${size}px;
            border-radius:50%;
            background:radial-gradient(circle at 32% 32%, rgba(255,255,255,0.98) 0%, rgba(220,245,255,0.85) 18%, rgba(180,225,255,0.55) 40%, rgba(120,195,255,0.25) 65%, rgba(60,160,240,0.08) 85%, transparent 100%);
            box-shadow:
                inset -2px -4px 8px rgba(255,255,255,0.9),
                inset 2px 2px 6px rgba(0,100,200,0.15),
                inset 0 0 12px rgba(200,235,255,0.3),
                0 6px 20px rgba(0,120,220,0.12),
                0 2px 6px rgba(0,80,180,0.08);
            border:1.5px solid rgba(255,255,255,0.65);
            pointer-events:auto;
            cursor:pointer;
            z-index:9998;
            user-select:none;
            animation: bubbleFall ${FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)}ms linear forwards;
            opacity:0.92;
            transition: transform 0.12s ease, opacity 0.12s ease;
        `;

        bubble.addEventListener('click', function(e) {
            e.stopPropagation();
            popBubble(bubble);
        });

        bubble.addEventListener('mouseenter', function() {
            bubble.style.transform = 'scale(1.12)';
            bubble.style.opacity = '1';
            bubble.style.filter = 'brightness(1.15)';
        });
        bubble.addEventListener('mouseleave', function() {
            bubble.style.transform = 'scale(1)';
            bubble.style.opacity = '0.92';
            bubble.style.filter = 'brightness(1)';
        });

        bubble.addEventListener('animationend', function() {
            removeBubble(bubble);
        });

        bubbleContainer.appendChild(bubble);
        bubbles.push(bubble);
    }

    const POP_SOUND = new Audio('/sounds/bubble-pop.mp3');
    POP_SOUND.preload = 'auto';
    function playPopSound() {
        try {
            const clone = POP_SOUND.cloneNode();
            clone.volume = 0.6;
            clone.play().catch(() => {});
        } catch (e) { /* ignore audio errors */ }
    }

    function popBubble(bubble) {
        const size = parseFloat(bubble.style.width);
        const rect = bubble.getBoundingClientRect();
        const cx = rect.left + size / 2;
        const cy = rect.top + size / 2;

        playPopSound();

        // Flash ring
        const ring = document.createElement('div');
        ring.style.cssText = `
            position:fixed;
            left:${cx}px;
            top:${cy}px;
            width:0;
            height:0;
            border-radius:50%;
            border:3px solid rgba(200,240,255,0.9);
            transform:translate(-50%,-50%);
            z-index:9999;
            pointer-events:none;
            animation: bubblePopRing 0.35s ease-out forwards;
        `;
        bubbleContainer.appendChild(ring);
        setTimeout(() => ring.remove(), 400);

        // White flash core
        const flash = document.createElement('div');
        flash.style.cssText = `
            position:fixed;
            left:${cx - size/2}px;
            top:${cy - size/2}px;
            width:${size}px;
            height:${size}px;
            border-radius:50%;
            background:radial-gradient(circle,rgba(255,255,255,0.95) 0%,rgba(200,235,255,0.6) 40%,transparent 70%);
            z-index:9999;
            pointer-events:none;
            animation: bubblePopFlash 0.25s ease-out forwards;
        `;
        bubbleContainer.appendChild(flash);
        setTimeout(() => flash.remove(), 300);

        // Mini droplets
        for (let i = 0; i < 8; i++) {
            const drop = document.createElement('div');
            const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
            const dist = 20 + Math.random() * 50;
            drop.style.cssText = `
                position:fixed;
                left:${cx}px;
                top:${cy}px;
                width:${size * (0.12 + Math.random() * 0.12)}px;
                height:${size * (0.12 + Math.random() * 0.12)}px;
                border-radius:50%;
                background:radial-gradient(circle at 35% 35%,rgba(255,255,255,0.95),rgba(180,220,255,0.7));
                box-shadow:0 1px 4px rgba(0,100,200,0.2);
                z-index:9999;
                pointer-events:none;
                animation: bubblePopDrop 0.35s ease-out forwards;
            `;
            drop.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
            drop.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
            bubbleContainer.appendChild(drop);
            setTimeout(() => drop.remove(), 400);
        }

        // Remove original bubble immediately
        bubble.style.transition = 'none';
        bubble.style.opacity = '0';
        bubble.style.transform = 'scale(0)';
        setTimeout(() => removeBubble(bubble), 50);
    }

    function removeBubble(bubble) {
        if (bubble.parentElement) bubble.remove();
        bubbles = bubbles.filter(b => b !== bubble);
    }

    function clearAllBubbles() {
        if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
        bubbles.forEach(b => { if (b.parentElement) b.remove(); });
        bubbles = [];
    }

    function startBubbles() {
        if (running) return;
        if (isGamePage()) return;
        if (isLiteMode()) return;
        running = true;

        if (!bubbleContainer) {
            bubbleContainer = document.createElement('div');
            bubbleContainer.id = 'aero-bubble-layer';
            bubbleContainer.style.cssText = `
                position:fixed;
                top:0;left:0;right:0;bottom:0;
                pointer-events:none;
                z-index:9998;
                overflow:hidden;
            `;
            document.body.appendChild(bubbleContainer);
        }

        spawnTimer = setInterval(createBubble, BUBBLE_INTERVAL + Math.random() * 300);
    }

    function stopBubbles() {
        running = false;
        clearAllBubbles();
        // Nuke any stray bubble elements still in the DOM
        const container = document.getElementById('aero-bubble-layer');
        if (container) container.remove();
        bubbleContainer = null;
    }

    function applyFrutigerBackground() {
        const theme = getTheme();
        if (theme !== 'frutiger-aero') return;
        const b = document.body;
        b.style.backgroundColor = '#87CEEB';
        b.style.backgroundImage = "url('images/frutiger-aero-bg.jpg')";
        b.style.backgroundSize = 'cover';
        b.style.backgroundPosition = 'center';
        b.style.backgroundAttachment = 'fixed';
        b.style.backgroundRepeat = 'no-repeat';
        b.style.color = '#003366';
    }

    function isLiteMode() {
        try {
            if (localStorage.getItem('aerodynamixLite') === 'true') return true;
            if (document.body && document.body.classList.contains('lite-mode')) return true;
            return false;
        } catch (e) { return false; }
    }

    function sync() {
        if (isLiteMode()) { stopBubbles(); return; }
        const theme = getTheme();
        const onGame = isGamePage();
        if (theme === 'frutiger-aero' && !onGame) {
            startBubbles();
        } else {
            stopBubbles();
        }
        if (theme === 'frutiger-aero') {
            applyFrutigerBackground();
        }
    }

    // Inject keyframes if not already present
    if (!document.getElementById('aero-bubble-styles')) {
        const style = document.createElement('style');
        style.id = 'aero-bubble-styles';
        style.textContent = `
            @keyframes bubbleFall {
                0% { transform: translateY(0) translateX(0); opacity: 0.85; }
                10% { opacity: 0.9; }
                50% { transform: translateY(50vh) translateX(${Math.random() > 0.5 ? 15 : -15}px); }
                100% { transform: translateY(110vh) translateX(${Math.random() > 0.5 ? 30 : -30}px); opacity: 0.4; }
            }
            @keyframes bubblePopDrop {
                0% { transform: translate(0,0) scale(1); opacity:0.95; }
                100% { transform: translate(var(--dx,20px), var(--dy,20px)) scale(0); opacity:0; }
            }
            @keyframes bubblePopRing {
                0% { width:0; height:0; opacity:1; }
                100% { width:120px; height:120px; opacity:0; }
            }
            @keyframes bubblePopFlash {
                0% { transform: scale(1); opacity:1; }
                100% { transform: scale(2); opacity:0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Listen for theme changes (broadcast via storage event)
    window.addEventListener('storage', function(e) {
        if (e.key === 'aerodynamixTheme' || e.key === 'aerodynamixLite') {
            sync();
        }
    });

    // Listen for lite-mode toggle on the same tab
    window.addEventListener('aerodynamixLiteChanged', function() {
        sync();
    });

    // Also re-sync periodically (handles direct localStorage writes without storage event)
    setInterval(sync, 100);

    // Nuclear option: if body has lite-mode class, forcibly kill the bubble layer every 50ms
    setInterval(function() {
        if (document.body && document.body.classList.contains('lite-mode')) {
            const c = document.getElementById('aero-bubble-layer');
            if (c) c.remove();
            if (spawnTimer) { clearInterval(spawnTimer); spawnTimer = null; }
            running = false;
            bubbles = [];
        }
    }, 50);

    // Initial sync
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync);
    } else {
        sync();
    }
})();

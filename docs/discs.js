/* Aerodynamix - Dynamix Discs economy shared module */
(function() {
    'use strict';

    const COSTS = {
        GAME: 100,
        THEME: 200,
        MEDIA: 1000,
        DAILY_BONUS: 100
    };

    const VISUAL_THEMES = ['frutiger-aero', 'purple', 'blue', 'christmas'];

    function isPaid()    { return sessionStorage.getItem('authorized') === 'true'; }
    function isFreeTrial(){ return sessionStorage.getItem('free_trial') === 'true'; }
    function needsDiscs(){ return isFreeTrial() && !isPaid(); }

    async function api(path, options = {}) {
        const res = await fetch(path, { credentials: 'same-origin', ...options });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return data;
    }

    async function getBalance() {
        try {
            const data = await api('/api/discs');
            return data.discs;
        } catch (e) {
            return null;
        }
    }

    async function claimDaily() {
        return api('/api/discs/claim', { method: 'POST' });
    }

    async function spendGame() {
        return api('/api/discs/spend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: COSTS.GAME, feature: 'game' })
        });
    }

    async function purchaseTheme(theme) {
        return api('/api/discs/purchase-theme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme })
        });
    }

    async function unlockMedia() {
        return api('/api/discs/unlock-media', { method: 'POST' });
    }

    function hasVisualTheme(purchasedThemes) {
        return purchasedThemes && purchasedThemes.some(t => VISUAL_THEMES.includes(t));
    }

    // ── UI helpers ───────────────────────────────────────────────────────────

    function formatDiscs(n) {
        return (n || 0).toLocaleString();
    }

    function discIconHTML(size) {
        return `<img src="images/disc.png" alt="Disc" class="disc-icon ${size || ''}">`;
    }

    function ensureNavWidget() {
        let widget = document.getElementById('disc-nav-widget');
        if (widget) return widget;

        const navs = document.querySelectorAll('nav');
        navs.forEach(nav => {
            if (nav.querySelector('#disc-nav-widget')) return;
            widget = document.createElement('div');
            widget.id = 'disc-nav-widget';
            widget.className = 'disc-nav-widget';
            widget.innerHTML = `
                <div class="disc-balance" id="disc-balance-display">--</div>
                <button class="disc-claim-btn" id="disc-claim-btn" title="Claim daily bonus">+${COSTS.DAILY_BONUS}</button>
            `;
            nav.appendChild(widget);

            widget.querySelector('#disc-claim-btn').addEventListener('click', async () => {
                const btn = widget.querySelector('#disc-claim-btn');
                btn.disabled = true;
                btn.textContent = '…';
                try {
                    const result = await claimDaily();
                    updateNavWidget(result.disc_balance, false);
                    btn.textContent = 'Got it!';
                    setTimeout(() => { btn.textContent = '+' + COSTS.DAILY_BONUS; btn.disabled = false; }, 1500);
                } catch (e) {
                    alert(e.message);
                    btn.textContent = '+' + COSTS.DAILY_BONUS;
                    btn.disabled = false;
                }
            });
        });
        return widget;
    }

    async function updateNavWidget(balance, dailyAvailable) {
        const widget = ensureNavWidget();
        if (!widget) return;
        const display = widget.querySelector('#disc-balance-display');
        const claimBtn = widget.querySelector('#disc-claim-btn');

        if (!isPaid() && !isFreeTrial()) {
            display.innerHTML = discIconHTML('sm') + ' <span>Locked</span>';
            claimBtn.style.display = 'none';
            return;
        }

        if (isPaid()) {
            display.innerHTML = discIconHTML('sm') + ' <span class="disc-unlimited">Unlimited</span>';
            claimBtn.style.display = 'none';
            return;
        }

        // Free trial: need account login
        if (balance === null || balance === undefined) {
            display.innerHTML = discIconHTML('sm') + ' <span class="disc-login">Log in to Connect</span>';
            claimBtn.style.display = 'none';
            return;
        }

        display.innerHTML = discIconHTML('sm') + ` <span>${formatDiscs(balance)}</span>`;
        claimBtn.style.display = dailyAvailable ? 'inline-flex' : 'none';
    }

    async function refreshNavWidget() {
        if (isPaid()) {
            updateNavWidget(0, false);
            return;
        }
        if (!isFreeTrial()) {
            updateNavWidget(null, false);
            return;
        }
        const info = await getBalance();
        if (info) {
            await updateNavWidget(info.disc_balance, info.daily_available);
        } else {
            await updateNavWidget(null, false);
        }
    }

    // ── Feature gating ───────────────────────────────────────────────────────

    async function tryLaunchGame(gameUrl) {
        if (isPaid()) {
            window.location.href = gameUrl;
            return;
        }
        if (!isFreeTrial()) return;
        const info = await getBalance();
        if (!info) {
            alert('Create a free Dynamix Connect account and log in to play games with Dynamix Discs.');
            return;
        }
        if ((info.disc_balance || 0) < COSTS.GAME) {
            alert(`You need ${COSTS.GAME} Dynamix Discs to play. Claim your daily bonus or log in again tomorrow.`);
            return;
        }
        if (confirm(`Play this game for ${COSTS.GAME} Dynamix Discs?`)) {
            try {
                const result = await spendGame();
                await updateNavWidget(result.disc_balance, false);
                window.location.href = gameUrl;
            } catch (e) {
                alert(e.message);
            }
        }
    }

    async function tryUnlockMedia() {
        if (isPaid()) return true;
        if (!isFreeTrial()) return false;
        const info = await getBalance();
        if (!info) {
            alert('Create a free Dynamix Connect account and log in to unlock features with Dynamix Discs.');
            return false;
        }
        if (info.media_unlocked) return true;
        if ((info.disc_balance || 0) < COSTS.MEDIA) {
            alert(`The Media Player costs ${COSTS.MEDIA} Dynamix Discs to unlock.`);
            return false;
        }
        if (confirm(`Unlock the Media Player for ${COSTS.MEDIA} Dynamix Discs?`)) {
            try {
                const result = await unlockMedia();
                await updateNavWidget(result.disc_balance, false);
                return true;
            } catch (e) {
                alert(e.message);
                return false;
            }
        }
        return false;
    }

    async function tryUseTheme(theme) {
        if (isPaid()) return { purchased: true, apply: true };
        if (!isFreeTrial()) return { purchased: false, apply: false };
        const info = await getBalance();
        if (!info) {
            alert('Create a free Dynamix Connect account and log in to buy themes with Dynamix Discs.');
            return { purchased: false, apply: false };
        }
        const purchased = info.purchased_themes || [];
        if (purchased.includes(theme)) return { purchased: true, apply: true };

        if ((info.disc_balance || 0) < COSTS.THEME) {
            alert(`You need ${COSTS.THEME} Dynamix Discs to buy the ${theme} theme.`);
            return { purchased: false, apply: false };
        }
        if (confirm(`Buy the ${theme} theme for ${COSTS.THEME} Dynamix Discs?`)) {
            try {
                const result = await purchaseTheme(theme);
                await updateNavWidget(result.disc_balance, false);
                return { purchased: true, apply: true };
            } catch (e) {
                alert(e.message);
                return { purchased: false, apply: false };
            }
        }
        return { purchased: false, apply: false };
    }

    // ── Wire up game links on any page via event delegation ──────────────────
    function wireGameLinks() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('#games a, .featured .games-row a');
            if (!link) return;
            const href = link.getAttribute('href');
            if (!href || !href.includes('game-frame.html')) return;
            e.preventDefault();
            tryLaunchGame(href);
        });
    }

    // ── Expose ───────────────────────────────────────────────────────────────
    window.AeroDiscs = {
        COSTS,
        VISUAL_THEMES,
        isPaid,
        isFreeTrial,
        needsDiscs,
        getBalance,
        claimDaily,
        spendGame,
        purchaseTheme,
        unlockMedia,
        hasVisualTheme,
        tryLaunchGame,
        tryUnlockMedia,
        tryUseTheme,
        wireGameLinks,
        refreshNavWidget,
        updateNavWidget,
        formatDiscs,
        discIconHTML
    };

    document.addEventListener('DOMContentLoaded', () => {
        refreshNavWidget();
        wireGameLinks();
    });

    window.addEventListener('aerodynamixAuthorized', () => refreshNavWidget());
    window.addEventListener('aerodynamixFreeTrial', () => refreshNavWidget());
})();

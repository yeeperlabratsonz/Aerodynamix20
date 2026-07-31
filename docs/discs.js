/* Aerodynamix - Dynamix Discs economy shared module */
(function() {
    'use strict';

    const COSTS = {
        GAME: 100,
        THEME: 200,
        MEDIA: 1000,
        DAILY_BONUS: 100
    };

    const VISUAL_THEMES = ['frutiger-aero', 'purple', 'blue', 'christmas', 'bubble-gum-pink'];
    const GAME_ID_GROUPS = [
        ['games/run-3/', 'attached_assets/clrun3_1785269152832.html', 'attached_assets/clrun3_1784864951393.html'],
        ['games/drive-mad/', 'attached_assets/cldrivemad_1785269192927.html'],
        ['games/retro-bowl/', 'attached_assets/clretrobowl_1785269280952.html'],
        ['games/minecraft/', 'attached_assets/Eaglercraft1.12_1785377874032.html'],
        ['attached_assets/Hobo_1_1784866297260.html', 'attached_assets/hobo-fixed-1.html'],
        ['attached_assets/Hobo_2_1784866273340.html', 'attached_assets/hobo-fixed-2.html'],
        ['attached_assets/Hobo_3_1784866253185.html', 'attached_assets/hobo-fixed-3.html'],
        ['attached_assets/Hobo_4_1784866216457.html', 'attached_assets/hobo-fixed-4.html'],
        ['attached_assets/Hobo_5_1784866218574.html', 'attached_assets/hobo-fixed-5.html'],
        ['attached_assets/Hobo_6_1784866220679.html', 'attached_assets/hobo-fixed-6.html'],
        ['attached_assets/Hobo_7_1784866222995.html', 'attached_assets/hobo-fixed-7.html']
    ];
    const GAME_ID_LOOKUP = new Map(
        GAME_ID_GROUPS.flatMap(group => group.map(id => [id, group[0]]))
    );

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

    async function purchaseGame(game) {
        return api('/api/discs/purchase-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game })
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
                <a class="disc-claim-btn" id="disc-claim-btn" href="discs.html" title="Claim daily bonus">Claim</a>
            `;
            nav.appendChild(widget);

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

        // Every user type has a real balance. Alternate access changes which
        // features are included; it does not make the card economy unlimited.
        if (balance === null || balance === undefined) {
            display.innerHTML = discIconHTML('sm') + ' <span class="disc-login">--</span>';
            claimBtn.style.display = 'none';
            return;
        }

        display.innerHTML = discIconHTML('sm') + ` <span>${formatDiscs(balance)}</span>`;
        claimBtn.style.display = dailyAvailable ? 'inline-flex' : 'none';
    }

    async function refreshNavWidget() {
        if (!isPaid() && !isFreeTrial()) {
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

    function getPurchasedGames() {
        try {
            return JSON.parse(localStorage.getItem('aerodynamixPurchasedGames') || '[]');
        } catch (e) {
            return [];
        }
    }

    function normalizeGameId(game) {
        return GAME_ID_LOOKUP.get(String(game || '')) || String(game || '');
    }

    function gameIdsMatch(first, second) {
        return normalizeGameId(first) === normalizeGameId(second);
    }

    function addPurchasedGame(game) {
        const games = getPurchasedGames();
        if (!games.includes(game)) {
            games.push(game);
            localStorage.setItem('aerodynamixPurchasedGames', JSON.stringify(games));
        }
    }

    async function tryLaunchGame(gameUrl) {
        if (isPaid()) {
            window.location.href = gameUrl;
            return;
        }
        if (!isFreeTrial()) return;
        // Basic users are sent to the game page where the unlock overlay handles purchase
        window.location.href = gameUrl;
    }

    async function tryUnlockMedia() {
        if (isPaid()) return true;
        if (!isFreeTrial()) return false;
        const info = await getBalance();
        if (!info) {
            alert('Could not load your Dynamix Discs. Please try again.');
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
            alert('Could not load your Dynamix Discs. Please try again.');
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
        purchaseGame,
        purchaseTheme,
        unlockMedia,
        hasVisualTheme,
        normalizeGameId,
        gameIdsMatch,
        tryLaunchGame,
        tryUnlockMedia,
        tryUseTheme,
        getPurchasedGames,
        addPurchasedGame,
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

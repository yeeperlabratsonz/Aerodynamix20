(function () {
    'use strict';

    function isTrial() {
        return sessionStorage.getItem('free_trial') === 'true' &&
            sessionStorage.getItem('authorized') !== 'true';
    }

    function getLocalPurchases() {
        try {
            return JSON.parse(localStorage.getItem('aerodynamixPurchasedGames') || '[]');
        } catch (e) {
            return [];
        }
    }

    async function getPurchases() {
        const local = getLocalPurchases();
        try {
            const response = await fetch('/api/discs/purchased-games', { credentials: 'same-origin' });
            const data = await response.json();
            const merged = [...new Set(local.concat(Array.isArray(data.games) ? data.games : []))];
            localStorage.setItem('aerodynamixPurchasedGames', JSON.stringify(merged));
            return merged;
        } catch (e) {
            return local;
        }
    }

    async function filterGamesForTrial() {
        const trial = isTrial();
        const owned = trial ? await getPurchases() : [];
        if (trial) document.getElementById('spotlight')?.remove();

        const gameLinks = document.querySelectorAll('#games a[href*="game-frame.html?game="]');
        let visible = 0;
        gameLinks.forEach(link => {
            const game = new URL(link.href, window.location.href).searchParams.get('game');
            const show = !trial || owned.some(purchased => window.AeroDiscs &&
                window.AeroDiscs.gameIdsMatch(purchased, game));
            link.hidden = !show;
            if (show) visible++;
        });

        const empty = document.getElementById('no-games-msg');
        if (empty) {
            empty.textContent = visible
                ? ''
                : 'You do not own any games yet. Visit the Shop to unlock your first game.';
            empty.style.display = visible ? 'none' : 'block';
        }
        const games = document.getElementById('games');
        if (games) games.classList.add('game-visibility-ready');
        document.body.classList.add('games-visibility-ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', filterGamesForTrial);
    } else {
        filterGamesForTrial();
    }
    window.addEventListener('aerodynamixFreeTrial', filterGamesForTrial);
})();
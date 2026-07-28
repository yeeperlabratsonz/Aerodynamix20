(function () {
    'use strict';

    function isPaid() {
        return sessionStorage.getItem('authorized') === 'true';
    }

    function getOwned() {
        try {
            return JSON.parse(localStorage.getItem('aerodynamixPurchasedGames') || '[]');
        } catch (e) {
            return [];
        }
    }

    function setOwned(games) {
        localStorage.setItem('aerodynamixPurchasedGames', JSON.stringify(games));
    }

    async function loadOwned() {
        const local = getOwned();
        try {
            const response = await fetch('/api/discs/purchased-games', { credentials: 'same-origin' });
            const data = await response.json();
            const merged = [...new Set(local.concat(Array.isArray(data.games) ? data.games : []))];
            setOwned(merged);
            return merged;
        } catch (e) {
            return local;
        }
    }

    async function purchase(card) {
        const game = card.dataset.game;
        const button = card.querySelector('.shop-buy');
        if (isPaid()) {
            card.classList.add('owned');
            button.textContent = 'Included';
            button.disabled = true;
            return;
        }
        button.disabled = true;
        button.textContent = 'Unlocking…';
        try {
            const result = await window.AeroDiscs.purchaseGame(game);
            const owned = getOwned();
            if (!owned.includes(game)) owned.push(game);
            setOwned(owned);
            window.AeroDiscs.updateNavWidget(result.disc_balance, false);
            card.classList.add('owned');
            button.textContent = 'Owned';
        } catch (e) {
            alert(e.message);
            button.disabled = false;
            button.textContent = 'Buy for 100';
        }
    }

    async function purchaseTheme(card) {
        const theme = card.dataset.theme;
        const button = card.querySelector('.theme-buy');
        button.disabled = true;
        button.textContent = 'Unlocking…';
        try {
            const result = await window.AeroDiscs.purchaseTheme(theme);
            window.AeroDiscs.updateNavWidget(result.disc_balance, false);
            card.classList.add('owned');
            button.textContent = 'Owned';
        } catch (e) {
            alert(e.message);
            button.disabled = false;
            button.textContent = 'Buy for 200';
        }
    }

    async function init() {
        const owned = await loadOwned();
        document.querySelectorAll('.shop-card').forEach(card => {
            if (card.classList.contains('theme-shop-card')) return;
            const button = card.querySelector('.shop-buy');
            if (isPaid() || owned.includes(card.dataset.game)) {
                card.classList.add('owned');
                button.textContent = isPaid() ? 'Included' : 'Owned';
                button.disabled = true;
            } else {
                button.addEventListener('click', () => purchase(card));
            }
        });
        let purchasedThemes = [];
        const info = await window.AeroDiscs.getBalance();
        if (isPaid()) purchasedThemes = window.AeroDiscs.VISUAL_THEMES;
        else if (info) purchasedThemes = info.purchased_themes || [];
        document.querySelectorAll('.theme-shop-card').forEach(card => {
            const button = card.querySelector('.theme-buy');
            if (isPaid() || purchasedThemes.includes(card.dataset.theme)) {
                card.classList.add('owned');
                button.textContent = isPaid() ? 'Included' : 'Owned';
                button.disabled = true;
            } else {
                button.addEventListener('click', () => purchaseTheme(card));
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
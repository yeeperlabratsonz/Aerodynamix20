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

    async function init() {
        const owned = await loadOwned();
        document.querySelectorAll('.shop-card').forEach(card => {
            const button = card.querySelector('.shop-buy');
            if (isPaid() || owned.includes(card.dataset.game)) {
                card.classList.add('owned');
                button.textContent = isPaid() ? 'Included' : 'Owned';
                button.disabled = true;
            } else {
                button.addEventListener('click', () => purchase(card));
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
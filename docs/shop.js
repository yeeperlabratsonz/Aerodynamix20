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

    async function loadTradingCards() {
        try {
            const response = await fetch('/api/trading-cards', { credentials: 'same-origin' });
            const data = await response.json();
            const count = Array.isArray(data.cards) ? data.cards.length : 0;
            const countEl = document.getElementById('collection-count');
            if (countEl) countEl.textContent = `${count} card${count === 1 ? '' : 's'} collected`;
        } catch (e) {
            // The shop remains usable if the collection count cannot be loaded.
        }
    }

    function cardMarkup(card, index) {
        const safeName = String(card.name || 'Mystery Card').replace(/[<>&"]/g, '');
        const safeRarity = String(card.rarity || 'Common').replace(/[<>&"]/g, '');
        return `
            <article class="revealed-card" style="--card-accent:${card.accent || '#65c7ff'}">
                <div class="revealed-card-art">RUN<br>3</div>
                <div class="rarity">${safeRarity}</div>
                <h3>${safeName}</h3>
                <small>#${String(card.number || index + 1).padStart(3, '0')}</small>
            </article>`;
    }

    function openPackModal() {
        const modal = document.getElementById('pack-modal');
        if (!modal) return;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closePackModal() {
        const modal = document.getElementById('pack-modal');
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    async function purchaseCardPack() {
        const button = document.getElementById('buy-card-pack');
        if (!button || button.disabled) return;
        if (window.AeroDiscs && window.AeroDiscs.isPaid()) {
            alert('Card packs are available with Dynamix Discs during a free trial.');
            return;
        }
        button.disabled = true;
        button.firstChild.textContent = 'Purchasing…';
        try {
            const response = await fetch('/api/trading-cards/purchase-pack', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not purchase the pack.');
            if (window.AeroDiscs) await window.AeroDiscs.updateNavWidget(data.disc_balance, false);
            openPackModal();
            const opening = document.getElementById('pack-opening');
            const revealed = document.getElementById('revealed-cards');
            const title = document.getElementById('pack-stage-title');
            const subtitle = document.getElementById('pack-stage-subtitle');
            if (opening) opening.hidden = false;
            if (revealed) { revealed.hidden = true; revealed.innerHTML = ''; }
            if (title) title.textContent = 'Opening your pack…';
            if (subtitle) subtitle.textContent = 'Your Run 3 cards are being revealed.';
            await new Promise(resolve => setTimeout(resolve, 1900));
            if (opening) opening.hidden = true;
            if (revealed) {
                revealed.innerHTML = data.cards.map(cardMarkup).join('');
                revealed.hidden = false;
            }
            if (title) title.textContent = 'Pack opened!';
            if (subtitle) subtitle.textContent = 'Add these cards to your collection.';
            await loadTradingCards();
            button.firstChild.textContent = 'Open another pack';
        } catch (e) {
            alert(e.message);
            button.firstChild.textContent = 'Open pack';
        } finally {
            button.disabled = false;
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
        const packButton = document.getElementById('buy-card-pack');
        if (packButton) packButton.addEventListener('click', purchaseCardPack);
        const closeButton = document.getElementById('pack-close');
        if (closeButton) closeButton.addEventListener('click', closePackModal);
        const modal = document.getElementById('pack-modal');
        if (modal) modal.addEventListener('click', event => {
            if (event.target === modal) closePackModal();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closePackModal();
        });
        await loadTradingCards();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
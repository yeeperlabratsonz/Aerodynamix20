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

    function gameBuyLabel(label = 'Buy for 100') {
        return `${label} ${window.AeroDiscs && window.AeroDiscs.discIconHTML
            ? window.AeroDiscs.discIconHTML('sm')
            : '<img src="images/disc.png" alt="Dynamix Disc" class="disc-icon sm">'} `;
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
            button.innerHTML = gameBuyLabel();
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
        const rarityClass = safeRarity.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const safeImage = String(card.image || '').replace(/[^a-zA-Z0-9_./'-]/g, '');
        return `
            <article class="revealed-card rarity-${rarityClass}" style="--card-accent:${card.accent || '#ffffff'}">
                <div class="revealed-card-art"><img src="${safeImage}" alt="${safeName} game icon"></div>
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
        const doneButton = document.getElementById('pack-done');
        if (doneButton) doneButton.hidden = true;
    }

    async function purchaseCardPack() {
        const button = document.getElementById('buy-card-pack');
        if (!button || button.disabled) return;
            const fullVersion = Boolean(window.AeroDiscs && window.AeroDiscs.isPaid());
        button.disabled = true;
        button.firstChild.textContent = 'Purchasing…';
        try {
            const response = await fetch('/api/trading-cards/purchase-pack', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_version: fullVersion })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not purchase the pack.');
            if (window.AeroDiscs) await window.AeroDiscs.updateNavWidget(data.disc_balance, false);
            openPackModal();
            const opening = document.getElementById('pack-opening');
            const revealed = document.getElementById('revealed-cards');
            const title = document.getElementById('pack-stage-title');
            const subtitle = document.getElementById('pack-stage-subtitle');
            const doneButton = document.getElementById('pack-done');
            if (opening) opening.hidden = false;
            if (revealed) { revealed.hidden = true; revealed.innerHTML = ''; }
            if (doneButton) doneButton.hidden = true;
            if (title) title.textContent = 'Opening your pack…';
            if (subtitle) subtitle.textContent = 'Your Aerodynamix cards are being revealed.';
            await new Promise(resolve => setTimeout(resolve, 1900));
            if (opening) opening.hidden = true;
            if (revealed) {
                revealed.innerHTML = data.cards.map(cardMarkup).join('');
                revealed.hidden = false;
            }
            const godlyReveal = document.getElementById('godly-card-reveal');
            if (godlyReveal && data.cards.some(card => String(card.rarity).toUpperCase() === 'GODLY')) {
                godlyReveal.classList.remove('active');
                void godlyReveal.offsetWidth;
                godlyReveal.classList.add('active');
            }
            if (title) title.textContent = 'Pack opened!';
            if (subtitle) subtitle.textContent = 'Add these cards to your collection.';
            if (doneButton) doneButton.hidden = false;
            await loadTradingCards();
            button.firstChild.textContent = 'Open another pack';
        } catch (e) {
            alert(e.message);
            button.firstChild.textContent = 'Open pack';
        } finally {
            button.disabled = false;
        }
    }

    function setDailyPackState() {
        const button = document.getElementById('buy-card-pack');
        const price = document.getElementById('pack-price');
        const description = document.getElementById('pack-description');
        if (!button) return;
        if (price && window.AeroDiscs && window.AeroDiscs.isPaid()) {
            price.innerHTML = '<img src="images/disc.png" alt="" class="disc-icon sm"> 100 Dynamix Discs';
        }
        if (description && window.AeroDiscs && window.AeroDiscs.isPaid()) {
            description.textContent = 'Full-version members can open card packs using 100 Dynamix Discs, just like free members.';
        }
        button.disabled = false;
        button.classList.remove('daily-pack-locked');
        button.firstChild.textContent = 'Open pack';
        const small = button.querySelector('small');
        if (small) small.textContent = 'Open another pack whenever you have enough Discs';
    }

    function installSecretUnlock() {
        const sequence = ['ArrowUp', 'ArrowDown', '2', '0', '0', '5'];
        let position = 0;
        let activating = false;

        document.addEventListener('keydown', async event => {
            if (activating) return;

            const key = event.key;
            const expected = sequence[position];
            if (key === expected) {
                event.preventDefault();
                position++;
            } else {
                position = key === sequence[0] ? 1 : 0;
                if (position === 1) event.preventDefault();
            }

            if (position !== sequence.length) return;
            position = 0;
            activating = true;

            try {
                const response = await fetch('/api/access/secret-unlock', {
                    method: 'POST',
                    credentials: 'same-origin'
                });
                if (!response.ok) throw new Error('Could not activate access.');
                localStorage.setItem('aerodynamix_full_access', 'true');
                sessionStorage.setItem('authorized', 'true');
                sessionStorage.removeItem('free_trial');
                window.dispatchEvent(new CustomEvent('aerodynamixAuthorized'));
                window.location.reload();
            } catch (error) {
                activating = false;
                console.error('Secret access activation failed', error);
            }
        });
    }

    async function init() {
        installSecretUnlock();
        const owned = await loadOwned();
        const packButton = document.getElementById('buy-card-pack');
        if (packButton && isPaid()) {
            packButton.firstChild.textContent = 'Open pack';
            const packPrice = document.querySelector('.pack-price');
            if (packPrice) packPrice.innerHTML = '<img src="images/disc.png" alt="" class="disc-icon sm"> 100 Dynamix Discs';
            const packDescription = document.getElementById('pack-description');
            if (packDescription) packDescription.textContent = 'Full-version members can open card packs using 100 Dynamix Discs, just like free members.';
            setDailyPackState();
        }
        document.querySelectorAll('.shop-card').forEach(card => {
            if (card.classList.contains('theme-shop-card')) return;
            const button = card.querySelector('.shop-buy');
            if (!button) return;
            if (isPaid() || owned.includes(card.dataset.game)) {
                card.classList.add('owned');
                button.textContent = isPaid() ? 'Included' : 'Owned';
                button.disabled = true;
            } else {
                button.innerHTML = gameBuyLabel();
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
        if (packButton) packButton.addEventListener('click', purchaseCardPack);
        const closeButton = document.getElementById('pack-close');
        if (closeButton) closeButton.addEventListener('click', closePackModal);
        const doneButton = document.getElementById('pack-done');
        if (doneButton) doneButton.addEventListener('click', closePackModal);
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
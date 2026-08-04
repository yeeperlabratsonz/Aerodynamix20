(function () {
  const sellValues = { COMMON:10, UNCOMMON:15, RARE:20, EPIC:25, LEGENDARY:50, MYTHIC:100, GODLY:500, SECRET:3000 };
  const esc = value => String(value ?? '').replace(/[<>&"]/g, '');
  const safeImage = value => String(value || '').replace(/[^a-zA-Z0-9_./'-]/g, '');
  const grid = document.getElementById('collection-grid');
  const count = document.getElementById('card-count');
  const tokens = document.getElementById('token-count');
  const confirmBackdrop = document.getElementById('sell-confirm-backdrop');
  const confirmMessage = document.getElementById('sell-confirm-message');
  const cancelSell = document.getElementById('cancel-sell');
  const confirmSell = document.getElementById('confirm-sell');
  let pendingSell = null;

  function render(cards) {
    count.textContent = `${cards.length} card${cards.length === 1 ? '' : 's'}`;
    if (!cards.length) {
      grid.innerHTML = '<div class="empty-collection">No cards yet. Open a pack in the Shop to start collecting.</div>';
      return;
    }
    grid.innerHTML = cards.map((card, index) => {
      const rarity = String(card.rarity || 'Common').toUpperCase();
      const value = Number(card.sell_value) || sellValues[rarity] || 10;
      const rarityClass = rarity.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `<article class="collection-card rarity-${rarityClass}" style="--accent:${card.accent || '#fff'}">
        <div class="collection-card-art"><img src="${safeImage(card.image)}" alt="${esc(card.name)}"></div>
        <div class="collection-card-body"><h3>${esc(card.name || 'Mystery Card')}</h3>
        <div class="collection-rarity">${esc(rarity)}</div><small>#${esc(card.number || index + 1)} · Sell for ${value} Dynamix Discs</small>
        <button class="sell-card" data-card-id="${esc(card.id)}" data-card-name="${esc(card.name || 'this card')}" data-card-value="${value}">Sell for ${value}<img class="disc-icon" src="images/disc.png" alt="Dynamix Discs"></button></div>
      </article>`;
    }).join('');
    grid.querySelectorAll('.sell-card').forEach(button => button.addEventListener('click', () => askToSell(button)));
  }

  function askToSell(button) {
    pendingSell = button;
    confirmMessage.textContent = `Are you sure you want to sell ${button.dataset.cardName} for ${button.dataset.cardValue} Dynamix Discs? This cannot be undone.`;
    confirmBackdrop.classList.add('open');
    confirmBackdrop.setAttribute('aria-hidden', 'false');
    confirmSell.focus();
  }

  function closeConfirmation() {
    pendingSell = null;
    confirmBackdrop.classList.remove('open');
    confirmBackdrop.setAttribute('aria-hidden', 'true');
  }

  async function load() {
    const [cardsResponse, discsResponse] = await Promise.all([
      fetch('/api/trading-cards', { credentials:'same-origin' }),
      fetch('/api/discs', { credentials:'same-origin' })
    ]);
    const cards = (await cardsResponse.json()).cards || [];
    const discData = (await discsResponse.json()).discs || {};
    tokens.textContent = `${Number(discData.disc_balance || 0).toLocaleString()} Dynamix Discs`;
    render(cards);
  }

  async function sell(button) {
    button.disabled = true;
    try {
      const response = await fetch('/api/trading-cards/sell', {
        method:'POST', credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ card_id: button.dataset.cardId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sell card.');
      tokens.textContent = `${Number(result.disc_balance || 0).toLocaleString()} Dynamix Discs`;
      if (window.AeroDiscs && window.AeroDiscs.updateNavWidget) {
        await window.AeroDiscs.updateNavWidget(result.disc_balance, false);
      }
      await load();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  }
  cancelSell.addEventListener('click', closeConfirmation);
  confirmSell.addEventListener('click', () => {
    const button = pendingSell;
    closeConfirmation();
    if (button) sell(button);
  });
  confirmBackdrop.addEventListener('click', event => {
    if (event.target === confirmBackdrop) closeConfirmation();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && confirmBackdrop.classList.contains('open')) closeConfirmation();
  });
  load().catch(() => { grid.innerHTML = '<div class="empty-collection">Could not load your collection.</div>'; });
})();
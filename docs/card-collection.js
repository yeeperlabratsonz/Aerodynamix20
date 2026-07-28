(function () {
  const sellValues = { COMMON:10, UNCOMMON:15, RARE:20, EPIC:25, LEGENDARY:50, MYTHIC:100, GODLY:500 };
  const esc = value => String(value ?? '').replace(/[<>&"]/g, '');
  const safeImage = value => String(value || '').replace(/[^a-zA-Z0-9_./'-]/g, '');
  const grid = document.getElementById('collection-grid');
  const count = document.getElementById('card-count');
  const tokens = document.getElementById('token-count');

  function render(cards) {
    count.textContent = `${cards.length} card${cards.length === 1 ? '' : 's'}`;
    if (!cards.length) {
      grid.innerHTML = '<div class="empty-collection">No cards yet. Open a pack in the Shop to start collecting.</div>';
      return;
    }
    grid.innerHTML = cards.map((card, index) => {
      const rarity = String(card.rarity || 'Common').toUpperCase();
      const value = sellValues[rarity] || 10;
      return `<article class="collection-card" style="--accent:${card.accent || '#fff'}">
        <div class="collection-card-art"><img src="${safeImage(card.image)}" alt="${esc(card.name)}"></div>
        <div class="collection-card-body"><h3>${esc(card.name || 'Mystery Card')}</h3>
        <div class="collection-rarity">${esc(rarity)}</div><small>#${esc(card.number || index + 1)} · Sell for ${value} tokens</small>
        <button class="sell-card" data-card-id="${esc(card.id)}">Sell for ${value}<img class="disc-icon" src="images/disc.png" alt="tokens"></button></div>
      </article>`;
    }).join('');
    grid.querySelectorAll('.sell-card').forEach(button => button.addEventListener('click', () => sell(button)));
  }

  async function load() {
    const [cardsResponse, discsResponse] = await Promise.all([
      fetch('/api/trading-cards', { credentials:'same-origin' }),
      fetch('/api/discs', { credentials:'same-origin' })
    ]);
    const cards = (await cardsResponse.json()).cards || [];
    const discData = (await discsResponse.json()).discs || {};
    tokens.textContent = `${Number(discData.disc_balance || 0).toLocaleString()} tokens`;
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
      tokens.textContent = `${Number(result.disc_balance || 0).toLocaleString()} tokens`;
      await load();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  }
  load().catch(() => { grid.innerHTML = '<div class="empty-collection">Could not load your collection.</div>'; });
})();
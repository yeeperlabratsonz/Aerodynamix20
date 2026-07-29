(function () {
    const key = 'aerodynamixBytePet';
    const defaults = { hunger: 78, fun: 68, energy: 84, sleeping: false };
    let state = { ...defaults, ...(JSON.parse(localStorage.getItem(key) || '{}')) };
    const copy = {
        feed: ['Byte had a crunchy snack.', 'Hunger restored — Byte is ready for more arcade time.'],
        play: ['Byte is doing a victory dance!', 'Fun restored — energy spent.'],
        sleep: ['Byte is taking a power nap.', 'Sweet dreams. Energy is slowly coming back.']
    };
    function save() { localStorage.setItem(key, JSON.stringify(state)); }
    function render() {
        ['hunger','fun','energy'].forEach(name => {
            document.getElementById(name + '-bar').style.width = state[name] + '%';
            document.getElementById(name + '-value').textContent = state[name] + '%';
        });
        document.getElementById('pet-stage').classList.toggle('sleeping', state.sleeping);
        const mood = state.sleeping ? 'Dozing peacefully' : state.fun < 35 ? 'Needs attention' : 'Feeling good';
        document.getElementById('mood').textContent = mood;
        document.getElementById('activity').textContent = state.sleeping ? 'Zzz... power nap' : 'Ready to hang out';
    }
    function act(action) {
        if (action === 'feed') { state.hunger = Math.min(100, state.hunger + 24); state.sleeping = false; }
        if (action === 'play') { state.fun = Math.min(100, state.fun + 25); state.energy = Math.max(0, state.energy - 14); state.sleeping = false; }
        if (action === 'sleep') { state.sleeping = !state.sleeping; if (!state.sleeping) state.energy = Math.min(100, state.energy + 28); }
        const line = copy[action];
        document.getElementById('pet-note').textContent = state.sleeping ? line[0] : line[1];
        save(); render();
    }
    document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => act(button.dataset.action)));
    setInterval(() => {
        if (state.sleeping) state.energy = Math.min(100, state.energy + 1);
        else { state.hunger = Math.max(0, state.hunger - 1); state.fun = Math.max(0, state.fun - 1); }
        save(); render();
    }, 60000);
    render();
})();
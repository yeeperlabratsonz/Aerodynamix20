(function () {
  'use strict';

  var CONTAINER_ID = 'aerodynamix-snow';
  var MAX_FLAKES = 60;
  var flakes = [];
  var container = null;
  var interval = null;

  function createContainer() {
    if (container) return container;
    var el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '100vw';
    el.style.height = '100vh';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9998';
    el.style.overflow = 'hidden';
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.8s ease';
    document.body.appendChild(el);
    container = el;
    return el;
  }

  function removeContainer() {
    if (!container) return;
    document.body.removeChild(container);
    container = null;
    flakes = [];
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  function makeFlake() {
    if (!container || flakes.length >= MAX_FLAKES) return;
    var flake = document.createElement('div');
    var size = Math.random() * 4 + 2; // 2px - 6px
    var startLeft = Math.random() * 100;
    var duration = Math.random() * 6 + 5; // 5s - 11s
    var delay = Math.random() * 5;
    var drift = (Math.random() - 0.5) * 20;

    flake.style.position = 'absolute';
    flake.style.top = '-' + size + 'px';
    flake.style.left = startLeft + 'vw';
    flake.style.width = size + 'px';
    flake.style.height = size + 'px';
    flake.style.background = 'rgba(255, 255, 255, 0.85)';
    flake.style.borderRadius = '50%';
    flake.style.opacity = Math.random() * 0.6 + 0.3;
    flake.style.filter = 'blur(' + (Math.random() > 0.7 ? 1 : 0) + 'px)';
    flake.style.animationName = 'aerodynamix-snow-fall';
    flake.style.animationDuration = duration + 's';
    flake.style.animationDelay = '-' + delay + 's';
    flake.style.animationTimingFunction = 'linear';
    flake.style.animationIterationCount = 'infinite';
    flake.style.setProperty('--snow-drift', drift + 'px');

    container.appendChild(flake);
    flakes.push({ el: flake, born: Date.now() });
  }

  function pruneFlakes() {
    var now = Date.now();
    for (var i = flakes.length - 1; i >= 0; i--) {
      if (now - flakes[i].born > 60000) {
        try {
          container.removeChild(flakes[i].el);
        } catch (e) {}
        flakes.splice(i, 1);
      }
    }
  }

  function startSnow() {
    createContainer();
    if (container.style.opacity === '1') return;

    // Inject keyframes once
    if (!document.getElementById('aerodynamix-snow-style')) {
      var style = document.createElement('style');
      style.id = 'aerodynamix-snow-style';
      style.textContent =
        '@keyframes aerodynamix-snow-fall { ' +
        '0% { transform: translateY(-10px) translateX(0); } ' +
        '100% { transform: translateY(110vh) translateX(var(--snow-drift, 0)); } ' +
        '}';
      document.head.appendChild(style);
    }

    while (flakes.length < MAX_FLAKES) {
      makeFlake();
    }

    if (!interval) {
      interval = setInterval(function () {
        if (flakes.length < MAX_FLAKES) makeFlake();
        pruneFlakes();
      }, 400);
    }

    requestAnimationFrame(function () {
      if (container) container.style.opacity = '1';
    });
  }

  function stopSnow() {
    if (!container) return;
    container.style.opacity = '0';
    setTimeout(function () {
      removeContainer();
    }, 800);
  }

  function isChristmas() {
    try {
      return (localStorage.getItem('aerodynamixTheme') || 'black') === 'christmas';
    } catch (e) {
      return false;
    }
  }

  function update() {
    if (isChristmas()) {
      startSnow();
    } else {
      stopSnow();
    }
  }

  function init() {
    update();
    setInterval(update, 500);

    // React to storage changes in other tabs
    window.addEventListener('storage', function (e) {
      if (e.key === 'aerodynamixTheme') update();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

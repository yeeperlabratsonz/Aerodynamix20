(function () {
    'use strict';

    function getMenu(nav) {
        return Array.from(nav.children).find(function (child) {
            return child.tagName === 'DIV' &&
                (child.querySelector('a') || child.classList.contains('collection-nav-links') || child.classList.contains('discs-nav-links'));
        });
    }

    function setupNav(nav) {
        const menu = getMenu(nav);
        if (!menu || nav.querySelector('.mobile-menu-toggle')) return;

        const settings = Array.from(nav.children).find(function (child) {
            return child.tagName === 'A' && child.getAttribute('href') === 'colors.html';
        });
        const settingsParent = settings && settings.parentElement;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'mobile-menu-toggle';
        toggle.setAttribute('aria-label', 'Open navigation menu');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Menu';
        nav.insertBefore(toggle, menu);

        function isMobile() {
            return window.matchMedia('(max-width: 700px)').matches;
        }

        function syncSettings() {
            if (!settings) return;
            if (isMobile()) {
                if (settings.parentElement !== menu) {
                    settings.classList.add('mobile-nav-settings');
                    menu.appendChild(settings);
                }
            } else if (settings.parentElement !== settingsParent) {
                settings.classList.remove('mobile-nav-settings');
                nav.appendChild(settings);
            }
        }

        function close() {
            document.body.classList.remove('mobile-nav-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open navigation menu');
        }

        toggle.addEventListener('click', function () {
            const open = !document.body.classList.contains('mobile-nav-open');
            document.body.classList.toggle('mobile-nav-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
        });

        menu.addEventListener('click', function (event) {
            if (event.target.closest('a')) close();
        });

        document.addEventListener('click', function (event) {
            if (document.body.classList.contains('mobile-nav-open') &&
                !nav.contains(event.target)) close();
        });

        window.addEventListener('resize', function () {
            syncSettings();
            if (!isMobile()) close();
        }, { passive: true });

        syncSettings();
    }

    function init() {
        document.querySelectorAll('nav').forEach(setupNav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
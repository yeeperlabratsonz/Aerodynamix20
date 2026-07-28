/* Shared Aerodynamix tab cloak */
(function () {
    'use strict';

    const CLOAK_KEY = 'aerodynamixTabCloak';
    const CLOAK_TITLE = 'Google';
    const CLOAK_ICON = 'https://www.google.com/favicon.ico';

    function setFavicon(href) {
        let link = document.querySelector('link[rel~="icon"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.type = 'image/x-icon';
        link.href = href;
    }

    function applyTabCloak(enabled) {
        if (enabled) {
            document.title = CLOAK_TITLE;
            setFavicon(CLOAK_ICON);
        } else {
            document.title = document.body?.dataset.originalTitle || 'Aerodynamix';
            setFavicon('favicon.png');
        }
    }

    function isTabCloaked() {
        return localStorage.getItem(CLOAK_KEY) === 'true';
    }

    window.enableTabCloak = function () {
        const enabled = !isTabCloaked();
        localStorage.setItem(CLOAK_KEY, enabled ? 'true' : 'false');
        applyTabCloak(enabled);
        const button = document.querySelector('[onclick*="enableTabCloak"]');
        if (button) button.textContent = enabled ? 'Tab Cloak: ON' : 'Tab Cloak';
    };

    function init() {
        if (document.body && !document.body.dataset.originalTitle) {
            document.body.dataset.originalTitle = document.title;
        }
        applyTabCloak(isTabCloaked());
        const button = document.querySelector('[onclick*="enableTabCloak"]');
        if (button && isTabCloaked()) button.textContent = 'Tab Cloak: ON';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
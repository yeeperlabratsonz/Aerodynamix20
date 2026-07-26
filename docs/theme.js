/* Aerodynamix - Shared Theme Engine */
(function () {
    'use strict';

    window.applyTheme = function (theme) {
        var authorized = sessionStorage.getItem('authorized') === 'true';
        var body = document.body;
        var searchInput  = document.querySelector('.search input');
        var searchButton = document.querySelector('.search button');
        var settingsButton = document.querySelector('nav a[href="colors.html"]');
        var h1Elements   = document.querySelectorAll('h1');

        /* reset styles so switching themes never leaves leftovers */
        body.style.backgroundImage    = 'none';
        body.style.backgroundAttachment = '';
        body.style.backgroundSize     = '';
        body.style.backgroundRepeat   = '';
        body.style.backgroundPosition = '';
        if (searchInput)  { searchInput.style.border  = ''; searchInput.style.boxShadow  = ''; searchInput.style.backdropFilter  = ''; }
        if (searchButton) { searchButton.style.background = ''; searchButton.style.border = ''; searchButton.style.boxShadow = ''; searchButton.style.backdropFilter = ''; }
        if (settingsButton) { settingsButton.style.background = ''; settingsButton.style.boxShadow = ''; settingsButton.style.backdropFilter = ''; settingsButton.style.border = ''; }

        if (theme === 'black') {
            if (authorized) {
                body.style.backgroundColor   = '#030509';
                body.style.backgroundImage   = 'radial-gradient(ellipse at 50% 130%, rgba(44,127,252,0.32) 0%, rgba(44,127,252,0.08) 40%, transparent 65%), radial-gradient(ellipse at 20% 0%, rgba(44,127,252,0.10) 0%, transparent 35%)';
                body.style.backgroundSize    = 'cover';
                body.style.backgroundAttachment = 'fixed';
                body.style.backgroundRepeat  = 'no-repeat';
                body.style.color             = '#fff';
                if (searchInput)  { searchInput.style.backgroundColor  = 'rgba(255,255,255,0.05)'; searchInput.style.color  = '#fff'; searchInput.style.border  = '1px solid rgba(44,127,252,0.3)'; searchInput.style.boxShadow  = '0 0 0 1px rgba(44,127,252,0.15), 0 8px 24px rgba(0,0,0,0.3)'; }
                if (searchButton) { searchButton.style.background = 'linear-gradient(135deg, #2c7ffc 0%, #1a5fd0 100%)'; searchButton.style.color = '#fff'; searchButton.style.border = 'none'; searchButton.style.boxShadow = '0 6px 24px rgba(44,127,252,0.45), 0 0 0 1px rgba(44,127,252,0.2)'; }
                if (settingsButton) { settingsButton.style.background = 'linear-gradient(135deg, #2c7ffc 0%, #1a5fd0 100%)'; settingsButton.style.color = '#fff'; settingsButton.style.boxShadow = '0 6px 24px rgba(44,127,252,0.4), 0 0 0 1px rgba(44,127,252,0.2)'; }
                document.querySelectorAll('#games img').forEach(function (img) {
                    img.onmouseenter = function () { img.style.boxShadow = '0 12px 40px rgba(44,127,252,0.45), 0 0 0 1px rgba(44,127,252,0.25)'; img.style.transform = 'scale(1.03)'; };
                    img.onmouseleave = function () { img.style.boxShadow = ''; img.style.transform = ''; };
                });
            } else {
                body.style.backgroundColor = '#1b1b1b';
                body.style.backgroundImage = 'none';
                body.style.color           = '#fff';
                if (searchInput)  { searchInput.style.backgroundColor  = '#222222'; searchInput.style.color  = '#fff'; }
                if (searchButton) { searchButton.style.backgroundColor = '#fff';    searchButton.style.color = '#222222'; }
                if (settingsButton) { settingsButton.style.backgroundColor = '#2c7ffc'; settingsButton.style.color = '#fff'; }
            }
            h1Elements.forEach(function (h) { h.style.color = '#fff'; });

        } else if (theme === 'frutiger-aero') {
            body.style.backgroundColor   = '#87CEEB';
            body.style.backgroundImage   = "url('images/frutiger-aero-bg.jpg')";
            body.style.backgroundSize    = 'cover';
            body.style.backgroundPosition = 'center';
            body.style.backgroundAttachment = 'fixed';
            body.style.backgroundRepeat  = 'no-repeat';
            body.style.color             = '#002244';
            if (searchInput)  { searchInput.style.backgroundColor  = 'rgba(255,255,255,0.55)'; searchInput.style.color  = '#002244'; searchInput.style.border  = '1px solid rgba(255,255,255,0.5)'; searchInput.style.backdropFilter  = 'blur(12px)'; searchInput.style.boxShadow  = '0 4px 16px rgba(0,34,68,0.12)'; }
            if (searchButton) { searchButton.style.background = 'linear-gradient(135deg, rgba(0,70,140,0.75) 0%, rgba(0,40,90,0.85) 100%)'; searchButton.style.color = '#fff'; searchButton.style.border = '1px solid rgba(255,255,255,0.25)'; searchButton.style.backdropFilter = 'blur(12px)'; searchButton.style.boxShadow = '0 8px 24px rgba(0,40,90,0.3)'; }
            if (settingsButton) { settingsButton.style.background = 'linear-gradient(135deg, rgba(0,70,140,0.75) 0%, rgba(0,40,90,0.85) 100%)'; settingsButton.style.color = '#fff'; settingsButton.style.border = '1px solid rgba(255,255,255,0.25)'; settingsButton.style.backdropFilter = 'blur(12px)'; settingsButton.style.boxShadow = '0 8px 24px rgba(0,40,90,0.3)'; }
            h1Elements.forEach(function (h) { h.style.color = '#002244'; });

        } else if (theme === 'purple') {
            body.style.backgroundColor   = '#180826';
            body.style.backgroundImage   = 'radial-gradient(ellipse at 50% 130%, rgba(160,80,255,0.42) 0%, rgba(140,50,255,0.12) 45%, transparent 65%), radial-gradient(ellipse at 80% 0%, rgba(200,100,255,0.18) 0%, transparent 35%)';
            body.style.backgroundSize    = 'cover';
            body.style.backgroundAttachment = 'fixed';
            body.style.backgroundRepeat  = 'no-repeat';
            body.style.color             = '#f0e0ff';
            if (searchInput)  { searchInput.style.backgroundColor  = 'rgba(255,255,255,0.05)'; searchInput.style.color  = '#f0e0ff'; searchInput.style.border  = '1px solid rgba(160,80,255,0.55)'; searchInput.style.boxShadow  = '0 0 0 1px rgba(160,80,255,0.2), 0 8px 24px rgba(160,80,255,0.12)'; }
            if (searchButton) { searchButton.style.background = 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)'; searchButton.style.color = '#fff'; searchButton.style.border = 'none'; searchButton.style.boxShadow = '0 8px 28px rgba(147,51,234,0.45), 0 0 0 1px rgba(147,51,234,0.25)'; }
            if (settingsButton) { settingsButton.style.background = 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)'; settingsButton.style.color = '#fff'; settingsButton.style.boxShadow = '0 8px 28px rgba(147,51,234,0.4), 0 0 0 1px rgba(147,51,234,0.25)'; }
            h1Elements.forEach(function (h) { h.style.color = '#f0e0ff'; });

        } else if (theme === 'blue') {
            body.style.backgroundColor   = '#040d24';
            body.style.backgroundImage   = 'radial-gradient(ellipse at 50% 130%, rgba(59,130,246,0.45) 0%, rgba(44,127,252,0.12) 45%, transparent 65%), radial-gradient(ellipse at 20% 0%, rgba(96,165,250,0.18) 0%, transparent 35%)';
            body.style.backgroundSize    = 'cover';
            body.style.backgroundAttachment = 'fixed';
            body.style.backgroundRepeat  = 'no-repeat';
            body.style.color             = '#e0f0ff';
            if (searchInput)  { searchInput.style.backgroundColor  = 'rgba(255,255,255,0.05)'; searchInput.style.color  = '#e0f0ff'; searchInput.style.border  = '1px solid rgba(59,130,246,0.55)'; searchInput.style.boxShadow  = '0 0 0 1px rgba(59,130,246,0.2), 0 8px 24px rgba(59,130,246,0.12)'; }
            if (searchButton) { searchButton.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'; searchButton.style.color = '#fff'; searchButton.style.border = 'none'; searchButton.style.boxShadow = '0 8px 28px rgba(59,130,246,0.45), 0 0 0 1px rgba(59,130,246,0.25)'; }
            if (settingsButton) { settingsButton.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'; settingsButton.style.color = '#fff'; settingsButton.style.boxShadow = '0 8px 28px rgba(59,130,246,0.4), 0 0 0 1px rgba(59,130,246,0.25)'; }
            h1Elements.forEach(function (h) { h.style.color = '#e0f0ff'; });

        } else if (theme === 'christmas') {
            body.style.backgroundColor   = '#0a180d';
            body.style.backgroundImage   = 'radial-gradient(ellipse at 50% 120%, rgba(180,40,40,0.15) 0%, transparent 55%)';
            body.style.backgroundSize    = 'cover';
            body.style.backgroundAttachment = 'fixed';
            body.style.backgroundRepeat  = 'no-repeat';
            body.style.color             = '#fcebd4';
            if (searchInput)  { searchInput.style.backgroundColor  = 'rgba(255,255,255,0.05)'; searchInput.style.color  = '#fcebd4'; searchInput.style.border  = '1px solid rgba(255,215,0,0.25)'; searchInput.style.boxShadow  = '0 4px 16px rgba(180,40,40,0.1)'; }
            if (searchButton) { searchButton.style.background = 'linear-gradient(135deg, #b92e40 0%, #8a1c28 100%)'; searchButton.style.color = '#fff'; searchButton.style.border = 'none'; searchButton.style.boxShadow = '0 6px 20px rgba(185,46,64,0.35)'; }
            if (settingsButton) { settingsButton.style.background = 'linear-gradient(135deg, #b92e40 0%, #8a1c28 100%)'; settingsButton.style.color = '#fff'; settingsButton.style.boxShadow = '0 6px 20px rgba(185,46,64,0.3)'; }
            h1Elements.forEach(function (h) { h.style.color = '#fcebd4'; });
        }

    };

    function autoApply() {
        var authorized = sessionStorage.getItem('authorized') === 'true';
        var theme = authorized ? (localStorage.getItem('aerodynamixTheme') || 'black') : 'black';
        window.applyTheme(theme);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoApply);
    } else {
        autoApply();
    }

    window.addEventListener('aerodynamixAuthorized', autoApply);
})();

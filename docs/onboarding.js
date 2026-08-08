/* Aerodynamix first-visit quick tour */
(function () {
    'use strict';

    const SEEN_KEY = 'aerodynamix_quick_tour_seen';
    const steps = [
        {
            icon: 'fa-gamepad',
            title: 'Play',
            description: 'Spotlight shows a few favorites up top. Search or scroll the game grid to launch the full arcade.'
        },
        {
            icon: 'fa-compass',
            title: 'Explore',
            description: 'Apps has extra tools like the soundboard and drawing room. Settings lets you tune themes and effects.'
        },
        {
            icon: 'fa-layer-group',
            title: 'Collect',
            description: 'Earn Dynamix Discs, spend them in Shop, and open packs to build your Card Collection.'
        },
        {
            icon: 'fa-headphones',
            title: 'Listen & connect',
            description: 'Media Player keeps your music going, while Connect is for profiles, friends, messages, and calls.'
        }
    ];

    let currentStep = 0;
    let overlay = null;
    let card = null;

    function markSeen() {
        try {
            localStorage.setItem(SEEN_KEY, 'true');
        } catch (error) {
            // A storage-restricted browser should still be able to dismiss the tour.
        }
    }

    function hasBeenSeen() {
        try {
            return localStorage.getItem(SEEN_KEY) === 'true';
        } catch (error) {
            return false;
        }
    }

    function closeTour() {
        markSeen();
        if (!overlay) return;
        overlay.style.animation = 'aero-tour-fade-in .2s ease reverse both';
        setTimeout(function () {
            if (overlay) overlay.remove();
            overlay = null;
            card = null;
            document.body.style.overflow = '';
        }, 190);
    }

    function renderStep() {
        const step = steps[currentStep];
        const isLast = currentStep === steps.length - 1;
        card.innerHTML = `
            <button class="aero-tour-close" type="button" aria-label="Close tutorial">&times;</button>
            <p class="aero-tour-kicker">Quick tour <span aria-hidden="true">·</span> ${currentStep + 1} of ${steps.length}</p>
            <h1 class="aero-tour-title">${currentStep === 0 ? 'Welcome to Aerodynamix' : 'A little tour, then you’re free to explore'}</h1>
            <p class="aero-tour-description">${currentStep === 0 ? 'Here’s the short version of what’s here. Four stops, no busywork.' : 'That’s the whole map — just the useful bits.'}</p>
            <section class="aero-tour-feature" aria-live="polite">
                <div class="aero-tour-icon" aria-hidden="true"><i class="fa-solid ${step.icon}"></i></div>
                <div>
                    <h2>${step.title}</h2>
                    <p>${step.description}</p>
                </div>
            </section>
            <div class="aero-tour-progress" role="tablist" aria-label="Tutorial steps">
                ${steps.map(function (_, index) {
                    return `<button class="aero-tour-dot${index === currentStep ? ' is-active' : ''}" type="button" role="tab" aria-label="Go to step ${index + 1}" aria-selected="${index === currentStep}"></button>`;
                }).join('')}
            </div>
            <div class="aero-tour-footer">
                <button class="aero-tour-skip" type="button">Skip tour</button>
                <button class="aero-tour-next" type="button">${isLast ? 'Start exploring' : 'Next'}</button>
            </div>
        `;

        card.querySelector('.aero-tour-close').addEventListener('click', closeTour);
        card.querySelector('.aero-tour-skip').addEventListener('click', closeTour);
        card.querySelector('.aero-tour-next').addEventListener('click', function () {
            if (isLast) {
                closeTour();
                return;
            }
            currentStep += 1;
            renderStep();
        });
        card.querySelectorAll('.aero-tour-dot').forEach(function (dot, index) {
            dot.addEventListener('click', function () {
                currentStep = index;
                renderStep();
            });
        });
    }

    function showTour() {
        if (hasBeenSeen() || overlay || document.getElementById('key-overlay')) return;
        overlay = document.createElement('div');
        overlay.id = 'aero-onboarding';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'aero-tour-title');
        card = document.createElement('div');
        card.className = 'aero-tour-card';
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        renderStep();
        const title = card.querySelector('.aero-tour-title');
        if (title) title.id = 'aero-tour-title';
        const next = card.querySelector('.aero-tour-next');
        if (next) next.focus();
    }

    function waitUntilClear() {
        if (hasBeenSeen()) return;
        if (document.getElementById('aero-boot-screen') || document.getElementById('key-overlay')) {
            window.setTimeout(waitUntilClear, 250);
            return;
        }
        window.setTimeout(showTour, 180);
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && overlay) closeTour();
    });

    document.addEventListener('DOMContentLoaded', function () {
        waitUntilClear();
    });
    window.addEventListener('aerodynamixAuthorized', waitUntilClear);
})();
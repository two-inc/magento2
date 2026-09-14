/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 *
 * ABN-591. The unbranded chip palette — payment-term chips and company-mode
 * chips alike, in all four states, on the one stylesheet both Luma and Amasty
 * load.
 *
 * Computed values under the real stylesheet, not a reading of its text: a rule
 * a later selector out-scored would still be present in the source.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const STYLESHEET = path.join(REPO_ROOT, 'view/frontend/web/css/style.css');

const ACCENT = 'rgb(9, 16, 48)';
const GREY = 'rgb(227, 227, 227)';
const WHITE = 'rgb(255, 255, 255)';

/** Stands in for `:hover`, which jsdom cannot enter. A class scores the same as
 *  a pseudo-class, so the cascade the chips are read under is the real one. */
const HOVER = 'two-hover-probe';

/** Each chip in its real nesting — a chip measured outside its container misses
 *  every descendant selector that styles it. */
const CONTROLS = [
    {
        name: 'payment-term chip',
        base: 'two-term-chip',
        selected: 'two-term-chip--selected',
        wrap: ['<div class="two-term-chips"><div class="two-term-chips__container">', '</div></div>']
    },
    {
        name: 'company-mode chip',
        base: 'two-company-mode-chip',
        selected: 'two-company-mode-chip--selected',
        wrap: [
            '<span class="two-company-field-wrap"><div class="two-company-dropdown">'
                + '<div class="two-company-mode-chips">',
            '</div></div></span>'
        ]
    }
];

/**
 * jsdom resolves no `var()`, so every declaration that uses one is dropped. The
 * sheet is re-injected with the custom properties substituted, read back off
 * the document rather than parsed out of the file.
 *
 * @returns {void}
 */
function injectStylesheet() {
    const source = fs.readFileSync(STYLESHEET, 'utf8');

    const probe = document.createElement('style');
    probe.textContent = source;
    document.head.appendChild(probe);
    const root = window.getComputedStyle(document.documentElement);

    let resolved = source;
    new Set(source.match(/var\(--[\w-]+\)/g)).forEach((reference) => {
        const value = root.getPropertyValue(reference.slice(4, -1)).trim();
        if (value) {
            resolved = resolved.split(reference).join(value);
        }
    });

    document.head.innerHTML = '';
    const sheet = document.createElement('style');
    sheet.textContent = resolved.split(':hover').join('.' + HOVER);
    document.head.appendChild(sheet);
}

/**
 * @param {Object} control one entry of CONTROLS
 * @param {string} classes extra classes putting the chip into one state
 * @returns {Element} the chip
 */
function chip(control, classes) {
    injectStylesheet();
    document.body.innerHTML = control.wrap[0]
        + '<button type="button" class="' + control.base + ' ' + classes + '" id="chip">30 days</button>'
        + control.wrap[1];

    return document.getElementById('chip');
}

/**
 * @param {string} value a computed colour, hex or functional
 * @returns {string} the `rgb(r, g, b)` spelling
 */
function rgb(value) {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
    if (!hex) {
        return value.trim();
    }
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, '$&$&') : hex[1];

    return 'rgb(' + [0, 2, 4].map((at) => parseInt(digits.substr(at, 2), 16)).join(', ') + ')';
}

/**
 * @param {Element} element a chip
 * @returns {Object} the three values the spec pins per state
 */
function paint(element) {
    const computed = window.getComputedStyle(element);

    return {
        borderWidth: computed.borderWidth,
        borderColor: rgb(computed.borderColor),
        background: rgb(computed.backgroundColor)
    };
}

afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

describe.each(CONTROLS.map((control) => [control.name, control]))(
    'the unbranded %s palette (ABN-591)',
    (name, control) => {
        test.each([
            ['', '2px', GREY, WHITE, 'at rest: a grey outline on white'],
            [control.selected, '2px', ACCENT, ACCENT, 'selected: a solid accent fill'],
            [HOVER, '1px', ACCENT, GREY, 'hovered while unselected: a thinner accent outline on grey'],
            [
                control.selected + ' ' + HOVER,
                '2px',
                ACCENT,
                ACCENT,
                'hovered while selected: the pointer changes nothing'
            ]
        ])('%s -> %s %s on %s (%s)', (classes, borderWidth, borderColor, background) => {
            expect(paint(chip(control, classes))).toEqual({ borderWidth, borderColor, background });
        });

        test('the label on the selected chip stays legible against the fill', () => {
            expect(rgb(window.getComputedStyle(chip(control, control.selected)).color)).toBe(WHITE);
        });

        test('the chip does not resize under the pointer', () => {
            const sizes = ['', HOVER].map((state) => {
                const computed = window.getComputedStyle(chip(control, state));

                return ['Top', 'Right', 'Bottom', 'Left'].map((side) =>
                    parseFloat(computed['padding' + side])
                        + parseFloat(computed['border' + side + 'Width'])
                );
            });

            expect(sizes[1]).toEqual(sizes[0]);
        });

        test('the keyboard ring is the accent', () => {
            const focused = chip(control, '');

            focused.focus();

            expect(focused.matches(':focus-visible')).toBe(true);
            const ring = window.getComputedStyle(focused).outline.split(' ');

            expect([ring[0], ring[1], rgb(ring[2])]).toEqual(['2px', 'solid', ACCENT]);
        });
    }
);

describe('the chip accent is its own property (ABN-591)', () => {
    test('the shared blue is left where the links use it', () => {
        injectStylesheet();

        const root = window.getComputedStyle(document.documentElement);

        expect(root.getPropertyValue('--color-chip-accent').trim()).toBe('#091030');
        expect(root.getPropertyValue('--color-blue2').trim()).toBe('#3043d1');
    });

    test('the sole-trader link keeps the shared blue', () => {
        injectStylesheet();
        document.body.innerHTML = '<span class="two-sole-trader-note__link" id="link">Sole trader</span>';

        expect(rgb(window.getComputedStyle(document.getElementById('link')).color))
            .toBe('rgb(48, 67, 209)');
    });
});

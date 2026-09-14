/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 *
 * ABN-591. jsdom's `getComputedStyle` resolves the cascade by source order and
 * weighs no specificity, so `chip-palette.test.js` cannot tell a rule that wins
 * on score from one that wins on position — a higher-scoring rule inserted
 * above the chip block would repaint every chip in a browser and leave that
 * suite green. The cascade is scored here instead: for each chip state, each
 * property is resolved the way a browser resolves it, and the resolution must
 * be unique as well as correct.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const STYLESHEET = path.join(REPO_ROOT, 'view/frontend/web/css/style.css');

const ACCENT = '#091030';
const GREY = '#e3e3e3';
const WHITE = '#fff';

/** `:hover` is unreachable in jsdom, so the sheet is read with it swapped for a
 *  class — same score, same position, so neither half of the cascade moves. */
const HOVER = 'two-hover-probe';

const PINNED = ['border-width', 'border-color', 'background-color', 'color'];

/** A `border` or `background` shorthand carries these. */
const LONGHAND = {
    border: ['border-width', 'border-style', 'border-color'],
    background: ['background-color']
};

const STATES = [
    ['term rest', 'two-term-chip', ['2px', GREY, WHITE, ACCENT]],
    ['term selected', 'two-term-chip two-term-chip--selected', ['2px', ACCENT, ACCENT, WHITE]],
    ['term hover', 'two-term-chip ' + HOVER, ['1px', ACCENT, GREY, ACCENT]],
    [
        'term hover selected',
        'two-term-chip two-term-chip--selected ' + HOVER,
        ['2px', ACCENT, ACCENT, WHITE]
    ],
    ['term focus', 'two-term-chip', ['1px', ACCENT, GREY, ACCENT], { focused: true }],
    [
        'term focus selected',
        'two-term-chip two-term-chip--selected',
        ['2px', ACCENT, ACCENT, WHITE],
        { focused: true }
    ],
    [
        'term focus hover',
        'two-term-chip ' + HOVER,
        ['1px', ACCENT, GREY, ACCENT],
        { focused: true }
    ],
    [
        'term focus hover selected',
        'two-term-chip two-term-chip--selected ' + HOVER,
        ['2px', ACCENT, ACCENT, WHITE],
        { focused: true }
    ],
    [
        'term sole, disabled',
        'two-term-chip two-term-chip--single',
        ['2px', ACCENT, ACCENT, WHITE],
        { disabled: true }
    ],
    [
        'term sole, disabled and hovered',
        'two-term-chip two-term-chip--single ' + HOVER,
        ['2px', ACCENT, ACCENT, WHITE],
        { disabled: true }
    ],
    ['mode rest', 'two-company-mode-chip', ['2px', GREY, WHITE, ACCENT]],
    [
        'mode selected',
        'two-company-mode-chip two-company-mode-chip--selected',
        ['2px', ACCENT, ACCENT, WHITE]
    ],
    ['mode hover', 'two-company-mode-chip ' + HOVER, ['1px', ACCENT, GREY, ACCENT]],
    [
        'mode hover selected',
        'two-company-mode-chip two-company-mode-chip--selected ' + HOVER,
        ['2px', ACCENT, ACCENT, WHITE]
    ],
    ['mode focus', 'two-company-mode-chip', ['1px', ACCENT, GREY, ACCENT], { focused: true }],
    [
        'mode focus selected',
        'two-company-mode-chip two-company-mode-chip--selected',
        ['2px', ACCENT, ACCENT, WHITE],
        { focused: true }
    ],
    [
        'mode focus hover',
        'two-company-mode-chip ' + HOVER,
        ['1px', ACCENT, GREY, ACCENT],
        { focused: true }
    ],
    [
        'mode focus hover selected',
        'two-company-mode-chip two-company-mode-chip--selected ' + HOVER,
        ['2px', ACCENT, ACCENT, WHITE],
        { focused: true }
    ]
];

/**
 * @param {string} selector one compound selector, no comma
 * @returns {Array} the [id, class, element] triple CSS scores selectors by
 */
function score(selector) {
    const bare = selector.replace(/::[\w-]+/g, '');

    return [
        (bare.match(/#[\w-]+/g) || []).length,
        (bare.match(/\.[\w-]+/g) || []).length
            + (bare.match(/:(?!:)[\w-]+/g) || []).length
            + (bare.match(/\[[^\]]+\]/g) || []).length,
        (bare.replace(/[.#:[][^\s>+~,]*/g, '').match(/\b[a-z]+\b/g) || []).length
    ];
}

/**
 * @param {Array} left a score triple
 * @param {Array} right a score triple
 * @returns {number} negative, zero or positive, as a comparator
 */
function compare(left, right) {
    for (let at = 0; at < 3; at++) {
        if (left[at] !== right[at]) {
            return left[at] - right[at];
        }
    }

    return 0;
}

/**
 * The sheet's own rules, each compound selector scored and kept in source order.
 *
 * @returns {Array} {selector, score, order, declarations} entries
 */
function rules() {
    const style = document.createElement('style');
    style.textContent = fs.readFileSync(STYLESHEET, 'utf8').split(':hover').join('.' + HOVER);
    document.head.appendChild(style);

    const collected = [];
    Array.prototype.forEach.call(style.sheet.cssRules, (rule, order) => {
        if (!rule.selectorText) {
            return;
        }
        const declarations = {};
        for (let at = 0; at < rule.style.length; at++) {
            const property = rule.style[at];
            const value = rule.style.getPropertyValue(property);
            (LONGHAND[property] || [property]).forEach((longhand) => {
                declarations[longhand] = LONGHAND[property]
                    ? (value.match(/(#[0-9a-f]{3,8}|var\([^)]*\)|\b\d+px\b|\bsolid\b)/gi) || [])
                        .find((part) =>
                            longhand === 'border-width' ? /px$/.test(part)
                                : longhand === 'border-style' ? /solid/.test(part)
                                    : !/px$|solid/.test(part))
                    : value;
            });
        }
        rule.selectorText.split(',').forEach((one) => {
            collected.push({
                selector: one.trim(),
                score: score(one.trim()),
                order,
                declarations
            });
        });
    });

    return collected;
}

/**
 * @param {string} value a declared value, possibly a `var()` reference
 * @param {Object} tokens the `:root` custom properties
 * @returns {string} the value with one level of `var()` resolved
 */
function resolve(value, tokens) {
    const reference = /^var\((--[\w-]+)\)$/.exec((value || '').trim());

    return reference ? tokens[reference[1]] : (value || '').trim();
}

/**
 * @param {string} classes the chip's classes
 * @param {Object} options `focused` and `disabled`
 * @returns {Element} the chip, in the nesting both families are rendered in
 */
function mount(classes, options) {
    document.body.innerHTML = '<span class="two-company-field-wrap"><div class="two-company-dropdown">'
        + '<div class="two-company-mode-chips"><div class="two-term-chips">'
        + '<div class="two-term-chips__container">'
        + '<button type="button" class="' + classes + '" id="chip"'
        + (options.disabled ? ' disabled' : '') + '>30 days</button>'
        + '</div></div></div></div></span>';

    const chip = document.getElementById('chip');
    if (options.focused) {
        chip.focus();
    }

    return chip;
}

afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

describe('the chip cascade is decided by score, not by position (ABN-591)', () => {
    test.each(STATES.map((state) => [state[0], state]))('%s', (label, state) => {
        const [, classes, expected, options] = state;
        const all = rules();
        const root = window.getComputedStyle(document.documentElement);
        const tokens = {};
        Array.prototype.forEach.call(root, (property) => {
            if (property.startsWith('--')) {
                tokens[property] = root.getPropertyValue(property).trim();
            }
        });
        const chip = mount(classes, options || {});

        const resolved = PINNED.map((property) => {
            const matching = all.filter((rule) => {
                try {
                    return chip.matches(rule.selector) && rule.declarations[property] !== undefined;
                } catch (error) {
                    return false;
                }
            });
            const winner = matching.slice().sort((a, b) =>
                compare(a.score, b.score) || a.order - b.order
            ).pop();
            const tied = matching.filter((rule) =>
                winner && compare(rule.score, winner.score) === 0
                    && resolve(rule.declarations[property], tokens)
                        !== resolve(winner.declarations[property], tokens)
            );

            return {
                property,
                value: winner ? resolve(winner.declarations[property], tokens) : undefined,
                decidedByPosition: tied.map((rule) => rule.selector)
            };
        });

        expect(resolved).toEqual(PINNED.map((property, at) => ({
            property,
            value: expected[at],
            decidedByPosition: []
        })));
    });
});

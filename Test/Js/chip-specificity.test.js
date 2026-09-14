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
 *
 * The resolver refuses what it cannot model rather than passing over it: a
 * selector it cannot score, an at-rule it does not recognise, or a media
 * condition it cannot evaluate all fail the suite. Media blocks are descended
 * into and every state is resolved again at each width the sheet declares a
 * breakpoint for, so a rule that only applies at one viewport is still weighed.
 * Its one declared boundary is that it reads this module's own stylesheet — a
 * brand overlay ships its own, from its own repository, and the two are
 * composed there.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const STYLESHEET = path.join(REPO_ROOT, 'view/frontend/web/css/style.css');

const ACCENT = '#091030';
const GREY = '#e3e3e3';
const WHITE = '#fff';

/** Stand-ins for the pseudo-classes jsdom cannot enter. A class scores as a
 *  pseudo-class does and the substitution moves no rule, so neither half of the
 *  cascade shifts. */
const PROBES = { ':hover': 'two-hover-probe', ':active': 'two-active-probe' };

const PINNED = ['border-width', 'border-color', 'background-color', 'color'];

/** The shorthands that carry a pinned property. */
const LONGHAND = {
    border: ['border-width', 'border-style', 'border-color'],
    background: ['background-color']
};

/** Pseudo-classes this resolver scores. Anything else fails rather than
 *  scoring zero, which would silently hand the state to a weaker rule. */
const PSEUDO_CLASSES = [
    'hover', 'focus', 'focus-visible', 'focus-within', 'active', 'disabled',
    'enabled', 'checked', 'empty', 'root', 'first-child', 'last-child',
    'nth-child', 'nth-of-type', 'only-child', 'not'
];

const TERM = 'two-term-chip';
const MODE = 'two-company-mode-chip';
const SELECTED_PAINT = ['2px', ACCENT, ACCENT, WHITE];
const REST_PAINT = ['2px', GREY, WHITE, ACCENT];
const RAISED_PAINT = ['1px', ACCENT, GREY, ACCENT];

/**
 * @param {string} family the chip's base class
 * @returns {Array} that family's states, as [label, classes, paint, options]
 */
function statesFor(family) {
    const selected = family + ' ' + family + '--selected';
    const hover = PROBES[':hover'];
    const active = PROBES[':active'];

    return [
        [family + ' rest', family, REST_PAINT],
        [family + ' selected', selected, SELECTED_PAINT],
        [family + ' hover', family + ' ' + hover, RAISED_PAINT],
        [family + ' hover selected', selected + ' ' + hover, SELECTED_PAINT],
        [family + ' focus', family, RAISED_PAINT, { focused: true }],
        [family + ' focus selected', selected, SELECTED_PAINT, { focused: true }],
        [family + ' focus hover', family + ' ' + hover, RAISED_PAINT, { focused: true }],
        [family + ' focus hover selected', selected + ' ' + hover, SELECTED_PAINT, { focused: true }],
        [family + ' active', family + ' ' + active, REST_PAINT],
        [family + ' active selected', selected + ' ' + active, SELECTED_PAINT],
        [family + ' active hover', family + ' ' + hover + ' ' + active, RAISED_PAINT]
    ];
}

const STATES = statesFor(TERM).concat(statesFor(MODE)).concat([
    [
        'sole term, disabled',
        TERM + ' ' + TERM + '--single',
        SELECTED_PAINT,
        { disabled: true }
    ],
    [
        'sole term, disabled and hovered',
        TERM + ' ' + TERM + '--single ' + PROBES[':hover'],
        SELECTED_PAINT,
        { disabled: true }
    ]
]);

/**
 * @param {string} compound one compound selector, no combinator
 * @returns {Array} its [id, class, element] contribution
 * @throws {Error} on any construct this resolver does not model
 */
function scoreCompound(compound) {
    const counts = [0, 0, 0];
    let rest = compound;

    while (rest.length) {
        let match;
        if ((match = /^\*/.exec(rest))) {
            // The universal selector contributes nothing.
        } else if ((match = /^#[\w-]+/.exec(rest))) {
            counts[0]++;
        } else if ((match = /^\.[\w-]+/.exec(rest))) {
            counts[1]++;
        } else if ((match = /^\[[^\]]+\]/.exec(rest))) {
            counts[1]++;
        } else if ((match = /^::[\w-]+/.exec(rest))) {
            counts[2]++;
        } else if ((match = /^:not\(([^()]*)\)/.exec(rest))) {
            const inner = match[1].split(',').map((one) => scoreCompound(one.trim()));
            [0, 1, 2].forEach((at) => {
                counts[at] += Math.max.apply(null, inner.map((one) => one[at]));
            });
        } else if ((match = /^:([\w-]+)(\([^()]*\))?/.exec(rest))) {
            if (PSEUDO_CLASSES.indexOf(match[1]) === -1) {
                throw new Error('unscored pseudo-class ":' + match[1] + '" in "' + compound + '"');
            }
            counts[1]++;
        } else if ((match = /^[a-zA-Z][\w-]*/.exec(rest))) {
            counts[2]++;
        } else {
            throw new Error('unscored selector fragment "' + rest + '" in "' + compound + '"');
        }
        rest = rest.slice(match[0].length);
    }

    return counts;
}

/**
 * @param {string} selector one selector, no comma
 * @returns {Array} the [id, class, element] triple CSS scores it by
 */
function score(selector) {
    return selector
        .split(/[\s>+~]+/)
        .filter((compound) => compound.length)
        .reduce((total, compound) => {
            const part = scoreCompound(compound);

            return [total[0] + part[0], total[1] + part[1], total[2] + part[2]];
        }, [0, 0, 0]);
}

/**
 * Importance outranks specificity outright, which is the whole reason it is
 * modelled: an `!important` chip colour would win in a browser.
 *
 * @param {Object} left a candidate
 * @param {Object} right a candidate
 * @returns {number} negative, zero or positive, as a comparator
 */
function weigh(left, right) {
    if (left.important !== right.important) {
        return left.important ? 1 : -1;
    }
    for (let at = 0; at < 3; at++) {
        if (left.score[at] !== right.score[at]) {
            return left.score[at] - right.score[at];
        }
    }

    return 0;
}

/**
 * @param {string} value a `border` or `background` shorthand
 * @param {string} longhand the part wanted
 * @returns {string} that part, or undefined
 */
function part(value, longhand) {
    const pieces = value.match(/#[0-9a-f]{3,8}|var\([^)]*\)|\b[\d.]+px\b|\b(solid|dashed|dotted|none)\b/gi) || [];

    return pieces.find((piece) =>
        longhand === 'border-width' ? /px$/i.test(piece)
            : longhand === 'border-style' ? /^(solid|dashed|dotted|none)$/i.test(piece)
                : !/px$/i.test(piece) && !/^(solid|dashed|dotted|none)$/i.test(piece));
}

/**
 * @param {string} condition one media condition, no comma
 * @returns {Object} {types, min, max}
 * @throws {Error} on a feature this resolver cannot evaluate
 */
function parseCondition(condition) {
    let rest = condition.trim().toLowerCase().replace(/^only\s+/, '');
    const parsed = { type: 'all', min: 0, max: Infinity };

    const type = /^(all|screen|print)\b/.exec(rest);
    if (type) {
        parsed.type = type[1];
        rest = rest.slice(type[0].length).trim().replace(/^and\s+/, '');
    }
    while (rest.length) {
        const feature = /^\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)/.exec(rest);
        if (!feature) {
            throw new Error('unevaluable media condition "' + condition + '"');
        }
        parsed[feature[1]] = parseInt(feature[2], 10);
        rest = rest.slice(feature[0].length).trim().replace(/^and\s+/, '');
    }

    return parsed;
}

/**
 * @param {Array} conditions the media conditions wrapping a rule
 * @param {number} width the viewport being resolved at
 * @returns {boolean} whether the rule applies there
 */
function applies(conditions, width) {
    return conditions.every((list) =>
        list.some((one) => one.type !== 'print' && width >= one.min && width <= one.max));
}

/**
 * @param {CSSRule} rule one rule
 * @returns {Object} its declarations, longhands split out of the shorthands
 */
function declarationsOf(rule) {
    const declarations = {};
    for (let at = 0; at < rule.style.length; at++) {
        const property = rule.style[at];
        const value = rule.style.getPropertyValue(property);
        const important = rule.style.getPropertyPriority(property) === 'important';
        (LONGHAND[property] || [property]).forEach((longhand) => {
            declarations[longhand] = {
                value: LONGHAND[property] ? part(value, longhand) : value,
                important
            };
        });
    }

    return declarations;
}

/**
 * Every style rule in the sheet, scored, in source order, media blocks
 * descended into. An at-rule that is neither a media block nor `@keyframes`
 * fails rather than being passed over — a rule hidden inside one would repaint
 * a chip in a browser with this suite green.
 *
 * @returns {Array} candidates carrying selector, score, importance, media, order
 */
function candidates() {
    let source = fs.readFileSync(STYLESHEET, 'utf8');
    Object.keys(PROBES).forEach((pseudo) => {
        source = source.split(pseudo).join('.' + PROBES[pseudo]);
    });

    const style = document.createElement('style');
    style.textContent = source;
    document.head.appendChild(style);

    const collected = [];
    let order = 0;
    const walk = (rules, media) => {
        Array.prototype.forEach.call(rules, (rule) => {
            order++;
            if (rule.selectorText !== undefined && rule.style) {
                const declarations = declarationsOf(rule);
                rule.selectorText.split(',').forEach((one) => {
                    const selector = one.trim();
                    collected.push({
                        selector, score: score(selector), order, declarations, media
                    });
                });

                return;
            }
            if (rule.media && rule.cssRules) {
                const conditions = String(rule.media.mediaText).split(',').map(parseCondition);
                walk(rule.cssRules, media.concat([conditions]));

                return;
            }
            // Keyframes select by `animation-name`, never by a selector, so they
            // are never the winner of a static resolution.
            if (rule.name !== undefined && rule.cssRules) {
                return;
            }
            throw new Error('unmodelled at-rule "' + rule.cssText.slice(0, 60) + '"');
        });
    };
    walk(style.sheet.cssRules, []);

    return collected;
}

/**
 * Every width the sheet declares a breakpoint at, either side of it.
 *
 * @param {Array} all the candidates
 * @returns {Array} widths to resolve every state at
 */
function viewports(all) {
    const widths = { 360: true, 1280: true };
    all.forEach((rule) => rule.media.forEach((list) => list.forEach((one) => {
        if (one.min > 0) {
            widths[one.min] = true;
            widths[one.min - 1] = true;
        }
        if (one.max < Infinity) {
            widths[one.max] = true;
            widths[one.max + 1] = true;
        }
    })));

    return Object.keys(widths).map(Number).sort((a, b) => a - b);
}

/**
 * @param {Object} declared a declaration, or undefined
 * @param {Object} tokens the `:root` custom properties
 * @returns {string} the value with one level of `var()` resolved
 */
function resolve(declared, tokens) {
    const value = declared && declared.value !== undefined ? String(declared.value).trim() : '';
    const reference = /^var\((--[\w-]+)\)$/.exec(value);

    return reference ? tokens[reference[1]] : value;
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

describe('the chip cascade is decided by weight, not by position (ABN-591)', () => {
    test.each(STATES.map((state) => [state[0], state]))('%s', (label, state) => {
        const [, classes, expected, options] = state;
        const every = candidates();
        const root = window.getComputedStyle(document.documentElement);
        const tokens = {};
        Array.prototype.forEach.call(root, (property) => {
            if (property.startsWith('--')) {
                tokens[property] = root.getPropertyValue(property).trim();
            }
        });
        const chip = mount(classes, options || {});

        const readAt = (width) => {
        const all = every.filter((rule) => applies(rule.media, width));

        return PINNED.map((property) => {
            const matching = all.filter((rule) => {
                if (rule.declarations[property] === undefined) {
                    return false;
                }
                // A pseudo-element rule paints a generated box, never the chip's own.
                if (rule.selector.indexOf('::') !== -1) {
                    return false;
                }

                return chip.matches(rule.selector);
            }).map((rule) => Object.assign({}, rule, {
                // Importance is per declaration, so it is carried per property.
                important: rule.declarations[property].important
            }));
            const winner = matching.slice().sort((a, b) =>
                weigh(a, b) || a.order - b.order
            ).pop();
            const tied = matching.filter((rule) =>
                winner && weigh(rule, winner) === 0
                    && resolve(rule.declarations[property], tokens)
                        !== resolve(winner.declarations[property], tokens)
            );

            return {
                property,
                value: winner ? resolve(winner.declarations[property], tokens) : undefined,
                decidedByPosition: tied.map((rule) => rule.selector)
            };
        });
        };

        const wanted = PINNED.map((property, at) => ({
            property,
            value: expected[at],
            decidedByPosition: []
        }));
        const widths = viewports(every);

        expect(widths.length).toBeGreaterThan(0);
        expect(widths.map(readAt)).toEqual(widths.map(() => wanted));
    });

    test.each([
        ['.a', [0, 1, 0]],
        ['button', [0, 0, 1]],
        ['body button.two-term-chip.two-term-chip--selected', [0, 2, 2]],
        ['button[type="button"].two-term-chip', [0, 2, 1]],
        ['#id .a:hover', [1, 2, 0]],
        ['.a:not(.b.c)', [0, 3, 0]],
        ['.a > .b::before', [0, 2, 1]]
    ])('scores %s as %s', (selector, expected) => {
        expect(score(selector)).toEqual(expected);
    });

    test('every selector in the sheet is one the resolver models', () => {
        const all = candidates();
        const chip = mount(TERM, {});

        expect(all.length).toBeGreaterThan(0);
        all.forEach((rule) => {
            expect(() => score(rule.selector)).not.toThrow();
            if (rule.selector.indexOf('::') === -1) {
                expect(() => chip.matches(rule.selector)).not.toThrow();
            }
        });
    });
});

<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Model\Ui;

/**
 * Reduces buyer-facing copy to text plus links: an `<a>` with an http(s) href
 * survives, every other tag is dropped and its text kept, and all other markup
 * is escaped.
 *
 * Surviving anchors are rebuilt from scratch rather than filtered, so no
 * attribute this module does not itself emit can reach the page.
 */
class AnchorOnlyHtmlEscaper
{
    private const ALLOWED_TARGET = '_blank';
    private const ALLOWED_REL = 'noopener';

    public function escape(string $html): string
    {
        $parts = preg_split('/(<[^>]*>)/', $html, -1, PREG_SPLIT_DELIM_CAPTURE);
        if ($parts === false) {
            return '';
        }

        $result = '';
        $openAnchors = 0;
        foreach ($parts as $index => $part) {
            if ($index % 2 === 0) {
                $result .= $this->escapeText($part);
                continue;
            }

            if (preg_match('/^<\/a\s*>$/i', $part)) {
                if ($openAnchors > 0) {
                    $result .= '</a>';
                    $openAnchors--;
                }
                continue;
            }

            // A nested anchor is invalid HTML the browser would unnest anyway;
            // its text is kept, its tag is not.
            if ($openAnchors === 0 && preg_match('/^<a\s[^>]*>$/i', $part)) {
                $anchor = $this->rebuildAnchor($part);
                if ($anchor !== '') {
                    $result .= $anchor;
                    $openAnchors++;
                }
            }
        }

        return $result . str_repeat('</a>', $openAnchors);
    }

    private function escapeText(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES, 'UTF-8', false);
    }

    private function rebuildAnchor(string $tag): string
    {
        $attributes = $this->attributes($tag);
        $href = html_entity_decode(trim($attributes['href'] ?? ''), ENT_QUOTES, 'UTF-8');
        if (!preg_match('/^https?:\/\//i', $href)) {
            return '';
        }

        $anchor = '<a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '"';
        if (strtolower(trim($attributes['target'] ?? '')) === self::ALLOWED_TARGET) {
            $anchor .= ' target="' . self::ALLOWED_TARGET . '"';
        }
        if (strtolower(trim($attributes['rel'] ?? '')) === self::ALLOWED_REL) {
            $anchor .= ' rel="' . self::ALLOWED_REL . '"';
        }

        return $anchor . '>';
    }

    /** @return array<string, string> */
    private function attributes(string $tag): array
    {
        preg_match_all(
            '/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]+))/',
            $tag,
            $matches,
            PREG_SET_ORDER
        );

        $attributes = [];
        foreach ($matches as $match) {
            $name = strtolower($match[1]);
            if (!isset($attributes[$name])) {
                $attributes[$name] = $match[2] !== '' ? $match[2] : ($match[3] !== '' ? $match[3] : ($match[4] ?? ''));
            }
        }

        return $attributes;
    }
}

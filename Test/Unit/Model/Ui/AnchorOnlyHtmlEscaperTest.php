<?php
declare(strict_types=1);

namespace Two\Gateway\Test\Unit\Model\Ui;

use PHPUnit\Framework\TestCase;
use Two\Gateway\Model\Ui\AnchorOnlyHtmlEscaper;

/**
 * The checkout tile binds the subtitle unescaped, so this escaper is the whole
 * trust boundary between brand/merchant copy and the buyer's page.
 */
class AnchorOnlyHtmlEscaperTest extends TestCase
{
    private const URL = 'https://faq.example.test/x';

    /** @return array<string, array{0:string,1:string,2:string}> */
    public static function escapingRows(): array
    {
        return [
            'bare sentence' => [
                'For all companies, read more.',
                'For all companies, read more.',
                'copy with no markup is untouched',
            ],
            'permitted anchor' => [
                'For all companies, <a href="' . self::URL . '" target="_blank" rel="noopener">read more</a>.',
                'For all companies, <a href="' . self::URL . '" target="_blank" rel="noopener">read more</a>.',
                'the anchor this module emits survives verbatim',
            ],
            'anchor with onclick' => [
                '<a href="' . self::URL . '" onclick="steal()">read more</a>',
                '<a href="' . self::URL . '">read more</a>',
                'an event handler never reaches the page',
            ],
            'anchor with style' => [
                '<a href="' . self::URL . '" style="position:fixed;inset:0">read more</a>',
                '<a href="' . self::URL . '">read more</a>',
                'styling cannot turn the link into an overlay',
            ],
            'anchor with class' => [
                '<a href="' . self::URL . '" class="btn">read more</a>',
                '<a href="' . self::URL . '">read more</a>',
                'copy cannot borrow the theme\'s classes',
            ],
            'anchor with download' => [
                '<a href="' . self::URL . '" download="invoice.pdf">read more</a>',
                '<a href="' . self::URL . '">read more</a>',
                'the link cannot be turned into a download',
            ],
            'anchor with a foreign target' => [
                '<a href="' . self::URL . '" target="_top">read more</a>',
                '<a href="' . self::URL . '">read more</a>',
                'only the _blank this module emits is kept',
            ],
            'anchor with a foreign rel' => [
                '<a href="' . self::URL . '" rel="me">read more</a>',
                '<a href="' . self::URL . '">read more</a>',
                'only the noopener this module emits is kept',
            ],
            'javascript href' => [
                '<a href="javascript:alert(1)">read more</a>',
                'read more',
                'a script URL loses the anchor and keeps the text',
            ],
            'data href' => [
                '<a href="data:text/html,pwned">read more</a>',
                'read more',
                'a data URL loses the anchor and keeps the text',
            ],
            'nested tags' => [
                '<b>Bold</b> and <span style="x">span</span>',
                'Bold and span',
                'every non-anchor tag is dropped and its text kept',
            ],
            'unclosed anchor' => [
                '<a href="' . self::URL . '">read more',
                '<a href="' . self::URL . '">read more</a>',
                'an anchor left open is closed rather than swallowing the page',
            ],
            'unterminated tag' => [
                'read <a href="' . self::URL . '"',
                'read &lt;a href=&quot;' . self::URL . '&quot;',
                'a tag with no closing bracket is text, not markup',
            ],
            'script element' => [
                '<script>alert(1)</script>',
                'alert(1)',
                'a script element is reduced to inert text',
            ],
            'anchor inside anchor' => [
                '<a href="https://a.example.test/1">outer <a href="https://b.example.test/2">inner</a> tail</a>',
                '<a href="https://a.example.test/1">outer inner</a> tail',
                'a nested anchor loses its tag, not its text',
            ],
        ];
    }

    /**
     * @dataProvider escapingRows
     */
    public function testEscaping(string $input, string $expected, string $description): void
    {
        $this->assertSame($expected, (new AnchorOnlyHtmlEscaper())->escape($input), $description);
    }
}

<?php
declare(strict_types=1);

namespace Magento\Framework;

/**
 * Minimal Phrase stub for unit tests.
 *
 * Supports %1, %2, … placeholder replacement matching Magento's
 * real Phrase behaviour.
 */
class Phrase
{
    /** @var string */
    private $text;

    /** @var array */
    private $arguments;

    /** @var \Magento\Framework\Phrase\RendererInterface|null */
    private static $renderer;

    public function __construct(string $text, array $arguments = [])
    {
        $this->text = $text;
        $this->arguments = $arguments;
    }

    /** Nullable so a test can restore the untranslated default; Magento only ever swaps it. */
    public static function setRenderer($renderer = null): void
    {
        self::$renderer = $renderer;
    }

    public static function getRenderer()
    {
        return self::$renderer;
    }

    public function render(): string
    {
        if (self::$renderer !== null) {
            return (string)self::$renderer->render([$this->text], $this->arguments);
        }

        $result = $this->text;
        foreach ($this->arguments as $index => $value) {
            $result = str_replace('%' . ($index + 1), (string)$value, $result);
        }
        return $result;
    }

    public function __toString(): string
    {
        return $this->render();
    }

    public function getText(): string
    {
        return $this->text;
    }

    public function getArguments(): array
    {
        return $this->arguments;
    }
}

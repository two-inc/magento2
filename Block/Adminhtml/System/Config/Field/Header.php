<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Block\Adminhtml\System\Config\Field;

use Magento\Config\Block\System\Config\Form\Field;
use Magento\Framework\Data\Form\Element\AbstractElement;

/**
 * Render module information html element in Stores Configuration
 */
class Header extends Field
{

    private const SIGN_UP_URL = 'https://portal.two.inc/auth/merchant/signup';

    /**
     * @var string
     */
    protected $_template = 'Two_Gateway::system/config/field/header.phtml';

    /**
     * @inheritDoc
     */
    public function render(AbstractElement $element): string
    {
        $element->addClass('two');

        return $this->toHtml();
    }

    /**
     * Get Sign Up Url
     *
     * @return string
     */
    public function getSignUpUrl(): string
    {
        return self::SIGN_UP_URL;
    }
}

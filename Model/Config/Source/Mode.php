<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Model\Config\Source;

use Magento\Framework\Data\OptionSourceInterface;

/**
 * Mode Options
 */
class Mode implements OptionSourceInterface
{
    /**
     * Options getter
     *
     * @return array
     */
    public function toOptionArray(): array
    {
        return [
            [
                'value' => 'production',
                'label' => __('Production'),
            ],
            [
                'value' => 'sandbox',
                'label' => __('Sandbox'),
            ],
        ];
    }
}

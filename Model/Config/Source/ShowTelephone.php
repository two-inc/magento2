<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Model\Config\Source;

use Magento\Framework\Data\OptionSourceInterface;

/**
 * ShowTelephone Options
 */
class ShowTelephone implements OptionSourceInterface
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
                'value' => 'billing',
                'label' => __('On billing page'),
            ],
            [
                'value' => 'shipping',
                'label' => __('On shipping page'),
            ],
        ];
    }
}

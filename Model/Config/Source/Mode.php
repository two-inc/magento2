<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Model\Config\Source;

use Magento\Framework\Data\OptionSourceInterface;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;

/**
 * Mode Options
 */
class Mode implements OptionSourceInterface
{
    /**
     * @var ConfigRepository
     */
    public $configRepository;

    /**
     * @param ConfigRepository $configRepository
     */
    public function __construct(
        ConfigRepository $configRepository
    ) {
        $this->configRepository = $configRepository;
    }

    /**
     * Options getter
     *
     * @return array
     */
    public function toOptionArray(): array
    {
        $mode = $this->configRepository->getMode();
        $options = [
            [
                'value' => 'production',
                'label' => __('Production'),
            ],
            [
                'value' => 'sandbox',
                'label' => __('Sandbox'),
            ],
        ];
        if ($mode && ($mode != 'production' || $mode != 'sandbox')) {
            $options[] = [
                'value' => $mode,
                'label' => ucfirst($mode),
            ];
        }
        return $options;
    }
}

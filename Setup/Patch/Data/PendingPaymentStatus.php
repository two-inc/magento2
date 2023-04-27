<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Setup\Patch\Data;

use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;
use Two\Gateway\Model\Two;

/**
 * PendingPaymentStatus Data Patch
 */
class PendingPaymentStatus implements DataPatchInterface
{
    /**
     * @var ModuleDataSetupInterface
     */
    private $moduleDataSetup;

    /**
     * @param ModuleDataSetupInterface $moduleDataSetup
     */
    public function __construct(
        ModuleDataSetupInterface $moduleDataSetup
    ) {
        $this->moduleDataSetup = $moduleDataSetup;
    }

    /**
     * @inheritDoc
     */
    public function apply()
    {
        $this->moduleDataSetup->getConnection()->startSetup();

        if ($this->isStatusAdded()) {
            $this->moduleDataSetup->getConnection()->endSetup();
            return $this;
        }

        $this->moduleDataSetup->getConnection()->insert(
            $this->moduleDataSetup->getTable('sales_order_status'),
            ['status' => Two::STATUS_TWO_PENDING, 'label' => 'Two Pending']
        );

        $this->moduleDataSetup->getConnection()->insert(
            $this->moduleDataSetup->getTable('sales_order_status_state'),
            [
                'status' => Two::STATUS_TWO_PENDING,
                'state' => 'pending_payment',
                'is_default' => 1,
                'visible_on_front' => 0
            ]
        );

        $this->moduleDataSetup->getConnection()->endSetup();
        return $this;
    }

    /**
     * @return array
     */
    public static function getDependencies(): array
    {
        return [];
    }

    /**
     * @return array
     */
    public function getAliases(): array
    {
        return [];
    }

    /**
     * Check if status already added
     *
     * @return bool
     */
    private function isStatusAdded(): bool
    {
        $select = $this->moduleDataSetup->getConnection()->select()
            ->from($this->moduleDataSetup->getTable('sales_order_status'), 'status')
            ->where('status = :status');
        $bind = [':status' => Two::STATUS_TWO_PENDING];
        return (bool)$this->moduleDataSetup->getConnection()->fetchOne($select, $bind);
    }
}

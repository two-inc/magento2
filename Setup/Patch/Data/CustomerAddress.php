<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Setup\Patch\Data;

use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;
use Magento\Eav\Setup\EavSetupFactory;

/**
 * OrderStatuses Data Patch
 */
class CustomerAddress implements DataPatchInterface
{
    /**
     * @var ModuleDataSetupInterface
     */
    private $moduleDataSetup;

    /**
     * @var EavSetupFactory
     */
    protected $eavSetupFactory;

    /**
     * @param ModuleDataSetupInterface $moduleDataSetup
     * @param EavSetupFactory $eavSetupFactory
     */
    public function __construct(
        ModuleDataSetupInterface $moduleDataSetup,
        EavSetupFactory $eavSetupFactory
    ) {
        $this->moduleDataSetup = $moduleDataSetup;
        $this->eavSetupFactory = $eavSetupFactory;
    }

    /**
     * @inheritDoc
     */
    public function apply()
    {
        $this->moduleDataSetup->getConnection()->startSetup();

        $attributes = [
            ['key' => 'company_name', 'label' => 'Company Name'],
            ['key' => 'company_id', 'label' => 'Company Id'],
            ['key' => 'department', 'label' => 'Department'],
            ['key' => 'project', 'label' => 'Project'],
        ];

        $eavSetup = $this->eavSetupFactory->create(['setup' => $this->moduleDataSetup]);

        foreach ($attributes as $attribute) {
            $eavSetup->addAttribute(
                'customer_address',
                $attribute['key'],
                [
                    'type' => 'varchar',
                    'input' => 'text',
                    'label' => $attribute['label'],
                    'visible' => true,
                    'required' => false,
                    'user_defined' => true,
                    'system'=> false,
                    'group'=> 'General',
                    'global' => true,
                    'visible_on_front' => true,
                ]
            );
        }

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
}

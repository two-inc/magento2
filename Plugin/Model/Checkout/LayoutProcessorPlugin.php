<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */

namespace Two\Gateway\Plugin\Model\Checkout;

use Magento\Checkout\Block\Checkout\LayoutProcessor;
use Two\Gateway\Model\Config\Repository;

class LayoutProcessorPlugin
{
    /**
     * @var Repository
     */
    private $repository;

    /**
     * @param Repository $repository
     */
    public function __construct(
        Repository $repository
    ) {
        $this->repository = $repository;
    }

    /**
     * @param LayoutProcessor $subject
     * @param array $jsLayout
     * @return array
     */
    public function afterProcess(
        LayoutProcessor $subject,
        array  $jsLayout
    ) {
        $jsLayout['components']['checkout']['children']['steps']['children']['shipping-step']['children']
        ['shippingAddress']['children']['shipping-address-fieldset']['children']['company_id'] = [
            'component' => 'Magento_Ui/js/form/element/abstract',
            'config' => [
                'customScope' => 'shippingAddress.custom_attributes',
                'customEntry' => null,
                'template' => 'ui/form/field',
                'elementTmpl' => 'ui/form/element/input',
                'tooltip' => [
                    'description' => 'Company Id',
                ],
                'options' => [],
                'id' => 'company-id'
            ],
            'dataScope' => 'shippingAddress.custom_attributes.company_id',
            'label' => 'Company Id',
            'provider' => 'checkoutProvider',
            'visible' => false,
            'validation' => [
                'required-entry' => false
            ],
            'sortOrder' => 65,
            'options' => [],
            'filterBy' => null,
            'customEntry' => null,
            'id' => 'company-id',
            'value' => ''
        ];
        if ($this->repository->showTelephone() == 'shipping') {
            $jsLayout['components']['checkout']['children']['steps']['children']['shipping-step']['children']
            ['shippingAddress']['children']['shipping-address-fieldset']['children']['two_telephone'] = [
                'component' => 'Magento_Ui/js/form/element/abstract',
                'config' => [
                    'customScope' => 'shippingAddress.custom_attributes',
                    'customEntry' => null,
                    'template' => 'ui/form/field',
                    'elementTmpl' => 'ui/form/element/input',
                    'tooltip' => [
                        'description' => 'International company telephone number',
                    ],
                    'options' => [],
                    'id' => 'two-telephone'
                ],
                'dataScope' => 'shippingAddress.custom_attributes.two_telephone',
                'label' => 'International telephone',
                'provider' => 'checkoutProvider',
                'visible' => true,
                'validation' => [
                    'required-entry' => false
                ],
                'sortOrder' => 200,
                'options' => [],
                'filterBy' => null,
                'customEntry' => null,
                'id' => 'two-telephone',
                'value' => ''
            ];
        }
        return $jsLayout;
    }
}

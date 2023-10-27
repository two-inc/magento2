<?php

namespace Two\Gateway\Plugin\Model\Checkout;

class LayoutProcessorPlugin
{

    /**
     * @param \Magento\Checkout\Block\Checkout\LayoutProcessor $subject
     * @param array $jsLayout
     * @return array
     */

    public function afterProcess(
        \Magento\Checkout\Block\Checkout\LayoutProcessor $subject,
        array $jsLayout
    )
    {
        // get billing address form at billing step
        $billingAddressForm = $jsLayout['components']['checkout']['children']['steps']['children']['billing-step']['children']['payment']['children']['afterMethods']['children']['billing-address-form'];

        // move address form to shipping step
        $jsLayout['components']['checkout']['children']['steps']['children']['shipping-step']['children']['billing-address-form'] = $billingAddressForm;

        // remove form from billing step
        unset($jsLayout['components']['checkout']['children']['steps']['children']['billing-step']['children']['payment']['children']['afterMethods']['children']['billing-address-form']);

        return $jsLayout;
    }
}

<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Block\Adminhtml\Order;

use Magento\Sales\Block\Adminhtml\Order\View as OrderView;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;

/**
 * Order View Block
 */
class View extends OrderView
{
    /**
    * @var ConfigRepository
     */
    public $configRepository;

    /**
     * View constructor.
     *
     * @param ConfigRepository $configRepository
     * @param \Magento\Backend\Block\Widget\Context $context
     * @param \Magento\Framework\Registry $registry
     * @param \Magento\Sales\Model\Config $salesConfig
     * @param \Magento\Sales\Helper\Reorder $reorderHelper
     * @param array $data
     */
    public function __construct(
        ConfigRepository $configRepository,
        \Magento\Backend\Block\Widget\Context $context,
        \Magento\Framework\Registry $registry,
        \Magento\Sales\Model\Config $salesConfig,
        \Magento\Sales\Helper\Reorder $reorderHelper,
        array $data = []
    ) {
        $this->configRepository = $configRepository;
        parent::__construct($context, $registry, $salesConfig, $reorderHelper, $data);
    }

    /**
     * Get payment additional data
     *
     * @return array
     */
    public function getAdditionalData(): array
    {
        $order = $this->getOrder();
        $payment = $order->getPayment();
        return $payment->getAdditionalInformation();
    }

    /**
     * Get Two Credit Note Url
     *
     * @param array $data
     *
     * @return string
     */
    public function getTwoCreditNoteUrl(array $data): string
    {
        $order = $this->getOrder();
        $billingAddress = $order->getBillingAddress();
        $langParams = $billingAddress->getCountryId() == 'NO' ? '?lang=nb_NO' : '?lang=en_US';

        return isset($data['gateway_data']['credit_note_url'])
            ? $data['gateway_data']['credit_note_url'] . $langParams
            : '';
    }

    /**
     * Get Two Credit Invoice Url
     *
     * @param array $data
     *
     * @return string
     */
    public function getTwoInvoiceUrl(array $data): string
    {
        $order = $this->getOrder();
        $billingAddress = $order->getBillingAddress();
        $langParams = $billingAddress->getCountryId() == 'NO' ? '?lang=nb_NO' : '?lang=en_US';

        return (isset($data['gateway_data']['invoice_url'])) ? $data['gateway_data']['invoice_url'] . $langParams : '';
    }

    /**
     * Get Two Order ID
     *
     * @param array $data
     *
     * @return string
     */
    public function getTwoOrderId(array $data): string
    {
        return (isset($data['gateway_data']['external_order_id'])) ? $data['gateway_data']['external_order_id'] : '';
    }

    /**
     * Get Method from Payment
     *
     * @return string
     */
    public function getMethod(): string
    {
        return $this->getOrder()->getPayment()->getMethod();
    }
}

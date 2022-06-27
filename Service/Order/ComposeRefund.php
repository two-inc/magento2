<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service\Order;

use Magento\Catalog\Helper\Image;
use Magento\Catalog\Model\ResourceModel\Category\CollectionFactory as CategoryCollection;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\Url;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Creditmemo;
use Magento\Store\Model\App\Emulation;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Service\Order as OrderService;

/**
 * Compose Refund Service
 */
class ComposeRefund extends OrderService
{
    /**
     * @var GetLineItemsRefund
     */
    private $getLineItemsRefund;

    /**
     * ComposeRefund constructor.
     *
     * @param GetLineItemsRefund $getLineItemsRefund
     * @param Image $imageHelper
     * @param ConfigRepository $configRepository
     * @param CategoryCollection $categoryCollectionFactory
     * @param Emulation $appEmulation
     * @param Url $url
     */
    public function __construct(
        GetLineItemsRefund $getLineItemsRefund,
        Image $imageHelper,
        ConfigRepository $configRepository,
        CategoryCollection $categoryCollectionFactory,
        Emulation $appEmulation,
        Url $url
    ) {
        parent::__construct($imageHelper, $configRepository, $categoryCollectionFactory, $appEmulation, $url);
        $this->getLineItemsRefund = $getLineItemsRefund;
    }

    /**
     * Compose request body for two refund order
     *
     * @param Creditmemo $creditmemo
     * @param float $amount
     * @param Order $order
     * @return array
     * @throws LocalizedException
     * @throws NoSuchEntityException
     */
    public function execute(Creditmemo $creditmemo, float $amount, Order $order): array
    {
        return [
            'amount' => $this->roundAmt($amount),
            'currency' => $order->getOrderCurrencyCode(),
            'initiate_payment_to_buyer' => true,
            'line_items' => array_values($this->getLineItemsRefund->execute($order, $creditmemo)),
        ];
    }
}

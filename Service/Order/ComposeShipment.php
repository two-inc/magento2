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
use Magento\Sales\Api\Data\OrderItemInterface;
use Magento\Sales\Api\Data\ShipmentInterface;
use Magento\Sales\Api\Data\ShipmentItemInterface;
use Magento\Sales\Model\Order;
use Magento\Store\Model\App\Emulation;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Service\Order as OrderService;

/**
 * Compose Shipment Service
 */
class ComposeShipment extends OrderService
{
    /**
     * @var GetLineItemsShipment
     */
    private $getLineItemsShipment;

    /**
     * @var GetLineItems
     */
    private $getLineItems;

    /**
     * ComposeShipment constructor.
     *
     * @param GetLineItemsShipment $getLineItemsShipment
     * @param GetLineItems $getLineItems
     * @param Image $imageHelper
     * @param ConfigRepository $configRepository
     * @param CategoryCollection $categoryCollectionFactory
     * @param Emulation $appEmulation
     * @param Url $url
     */
    public function __construct(
        GetLineItemsShipment $getLineItemsShipment,
        GetLineItems $getLineItems,
        Image $imageHelper,
        ConfigRepository $configRepository,
        CategoryCollection $categoryCollectionFactory,
        Emulation $appEmulation,
        Url $url
    ) {
        parent::__construct($imageHelper, $configRepository, $categoryCollectionFactory, $appEmulation, $url);
        $this->getLineItemsShipment = $getLineItemsShipment;
        $this->getLineItems = $getLineItems;
    }

    /**
     * Compose request body for two ship order
     *
     * @param Order\Shipment $shipment
     * @param Order $order
     * @return array
     * @throws LocalizedException
     * @throws NoSuchEntityException
     */
    public function execute(Order\Shipment $shipment, Order $order): array
    {
        $orderItems = $this->getLineItems->execute($order); //items
        $shipmentItems = $this->getLineItemsShipment->execute($order, $shipment); //one shipment items

        $orderItems = $this->getRemainingItems($shipment, $orderItems);
        $shipmentItems = array_values($shipmentItems);
        $storeId = (int)$order->getStoreId();
        $billingAddress = $order->getBillingAddress();
        $additionalInformation = $order->getPayment()->getAdditionalInformation();
        $billingAddressData = [
            'city' => $billingAddress->getCity(),
            'country' => $billingAddress->getCountryId(),
            'organization_name' => $additionalInformation['buyer']['company']['company_name'],
            'postal_code' => $billingAddress->getPostcode(),
            'region' => ($billingAddress->getRegion() != '') ? $billingAddress->getRegion() : '',
            'street_address' => $billingAddress->getStreet()[0]
                . (isset($billingAddress->getStreet()[1]) ? $billingAddress->getStreet()[1] : ''),
        ];
        if (!$order->getIsVirtual()) {
            $shippingAddress = $order->getShippingAddress();
        } else {
            $shippingAddress = $billingAddress;
        }

        $shippingAddressData = [
            'city' => $shippingAddress->getCity(),
            'country' => $shippingAddress->getCountryId(),
            'organization_name' => $additionalInformation['buyer']['company']['company_name'],
            'postal_code' => $shippingAddress->getPostcode(),
            'region' => ($shippingAddress->getRegion() != '') ? $shippingAddress->getRegion() : '',
            'street_address' => $shippingAddress->getStreet()[0]
                . (isset($shippingAddress->getStreet()[1]) ? $shippingAddress->getStreet()[1] : ''),
        ];

        $totalDiscountAmountPartially = 0;
        $totalGrossAmountPartially = 0;
        $totalNetAmountPartially = 0;
        $totalTaxAmountAmountPartially = 0;
        $totalTaxRateAmountPartially = 0;
        foreach ($shipmentItems as $item) {
            $totalDiscountAmountPartially += $item['discount_amount'];
            $totalGrossAmountPartially += $item['gross_amount'];
            $totalNetAmountPartially += $item['net_amount'];
            $totalTaxAmountAmountPartially += $item['tax_amount'];
            $totalTaxRateAmountPartially += $item['tax_rate'];
        }

        $totalTaxRateAmountPartially = $totalTaxRateAmountPartially / count($shipmentItems);

        $totalDiscountAmountRemained = 0;
        $totalGrossAmountRemained = 0;
        $totalNetAmountRemained = 0;
        $totalTaxAmountAmountRemained = 0;
        $totalTaxRateAmountRemained = 0;
        foreach ($orderItems as $item) {
            $totalDiscountAmountRemained += $item['discount_amount'];
            $totalGrossAmountRemained += $item['gross_amount'];
            $totalNetAmountRemained += $item['net_amount'];
            $totalTaxAmountAmountRemained += $item['tax_amount'];
            $totalTaxRateAmountRemained += $item['tax_rate'];
        }

        $totalTaxRateAmountRemained = $totalTaxRateAmountRemained / count($shipmentItems);

        return [
            'partially_fulfilled_order' => [
                'billing_address' => $billingAddressData,
                'currency' => $order->getOrderCurrencyCode(),
                'discount_amount' => $this->roundAmt($totalDiscountAmountPartially),
                'discount_rate' => '0',
                'gross_amount' => $this->roundAmt($totalGrossAmountPartially),
                'invoice_type' => 'FUNDED_INVOICE',
                'line_items' => $shipmentItems,
                'merchant_additional_info' => $order->getIncrementId(),
                'merchant_order_id' => (string)($order->getIncrementId()),
                'merchant_reference' => $order->getIncrementId(),
                'net_amount' => $this->roundAmt($totalNetAmountPartially),
                'shipping_address' => $shippingAddressData,
                'tax_amount' => $this->roundAmt($totalTaxAmountAmountPartially),
                'tax_rate' => $this->roundAmt($totalTaxRateAmountPartially),
            ],
            'remained_order' => [
                'billing_address' => $billingAddressData,
                'currency' => $order->getOrderCurrencyCode(),
                'discount_amount' => $this->roundAmt($totalDiscountAmountRemained),
                'discount_rate' => '0',
                'gross_amount' => $this->roundAmt($totalGrossAmountRemained),
                'invoice_type' => 'FUNDED_INVOICE',
                'line_items' => array_values($orderItems),
                'merchant_additional_info' => $order->getIncrementId(),
                'merchant_order_id' => (string)($order->getIncrementId()),
                'merchant_reference' => $order->getIncrementId(),
                'net_amount' => $this->roundAmt($totalNetAmountRemained),
                'shipping_address' => $shippingAddressData,
                'tax_amount' => $this->roundAmt($totalTaxAmountAmountRemained),
                'tax_rate' => $this->roundAmt($totalTaxRateAmountRemained),
            ],
        ];
    }

    private function getRemainingItems(ShipmentInterface $shipment, array $orderItems): array
    {
        /** @var ShipmentItemInterface $shipmentItem */
        foreach ($shipment->getAllItems() as $shipmentItem) {
            /** @var OrderItemInterface $orderItem */
            $orderShipmentItem = $shipmentItem->getOrderItem();
            $remaining = $orderShipmentItem->getQtyToShip();
            $total = $orderShipmentItem->getQtyOrdered();

            //find order item
            $orderShipmentItemId = null;
            foreach ($orderItems as $id => $item) {
                if ($item['qty_to_ship'] == 0) {
                    unset($orderItems[$id]);
                    continue;
                }
                if ($item['order_item_id'] == $orderShipmentItem->getId()) {
                    $orderShipmentItemId = $id;
                }
            }
            if ($orderShipmentItemId === null) {
                continue;
            }

            $item = $orderItems[$orderShipmentItemId];
            $item['quantity'] = $remaining;
            $item['gross_amount'] = $this->roundAmt(($item['gross_amount'] / $total) * $remaining);
            $item['net_amount'] = $this->roundAmt(($item['net_amount'] / $total) * $remaining);
            $item['tax_amount'] = $this->roundAmt(($item['tax_amount'] / $total) * $remaining);

            $orderItems[$orderShipmentItemId] = $item;
        }

        return $orderItems;
    }
}

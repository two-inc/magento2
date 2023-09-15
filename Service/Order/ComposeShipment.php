<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service\Order;

use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Sales\Api\Data\OrderItemInterface;
use Magento\Sales\Api\Data\ShipmentInterface;
use Magento\Sales\Api\Data\ShipmentItemInterface;
use Magento\Sales\Model\Order;
use Two\Gateway\Service\Order as OrderService;

/**
 * Compose Shipment Service
 */
class ComposeShipment extends OrderService
{

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
        $shipmentItems = $this->getLineItemsShipment($order, $shipment);
        $orderItems = $this->getRemainingItems($shipment, $this->getLineItemsOrder($order));

        return [
            'partially_fulfilled_order' => [
                'billing_address' => $this->getAddress($order, [], 'billing'),
                'shipping_address' => $this->getAddress($order, [], 'shipping'),
                'currency' => $order->getOrderCurrencyCode(),
                'discount_amount' => $this->getSum($shipmentItems, 'discount_amount'),
                'gross_amount' => $this->getSum($shipmentItems, 'gross_amount'),
                'net_amount' => $this->getSum($shipmentItems, 'net_amount'),
                'tax_amount' => $this->getSum($shipmentItems, 'tax_amount'),
                'tax_rate' => reset($shipmentItems)['tax_rate'] ?? 0,
                'discount_rate' => '0',
                'invoice_type' => 'FUNDED_INVOICE',
                'line_items' => array_values($shipmentItems),
                'merchant_additional_info' => $order->getIncrementId(),
                'merchant_order_id' => (string)($order->getIncrementId()),
                'merchant_reference' => $order->getIncrementId(),
            ],
            'remained_order' => [
                'billing_address' => $this->getAddress($order, [], 'billing'),
                'shipping_address' => $this->getAddress($order, [], 'shipping'),
                'currency' => $order->getOrderCurrencyCode(),
                'discount_amount' => $this->getSum($orderItems, 'discount_amount'),
                'gross_amount' => $this->getSum($orderItems, 'gross_amount'),
                'net_amount' => $this->getSum($orderItems, 'net_amount'),
                'tax_amount' => $this->getSum($orderItems, 'tax_amount'),
                'tax_rate' => reset($orderItems)['tax_rate'] ?? 0,
                'discount_rate' => '0',
                'invoice_type' => 'FUNDED_INVOICE',
                'line_items' => array_values($orderItems),
                'merchant_additional_info' => $order->getIncrementId(),
                'merchant_order_id' => (string)($order->getIncrementId()),
                'merchant_reference' => $order->getIncrementId(),
            ],
        ];
    }

    /**
     * @param Order $order
     * @param Order\Shipment $shipment
     * @return array
     * @throws LocalizedException
     */
    public function getLineItemsShipment(Order $order, Order\Shipment $shipment): array
    {
        $items = [];
        foreach ($shipment->getAllItems() as $item) {
            $orderItem = $this->getOrderItem((int)$item->getOrderItemId());
            if (!$item->getQty() || !$product = $this->getProduct($order, $orderItem)) {
                continue;
            }

            $items[$orderItem->getItemId()] = [
                'order_item_id' => $item->getOrderItemId(),
                'name' => $item->getName(),
                'description' => $item->getName(),
                'gross_amount' => $this->roundAmt($this->getGrossAmountItem($orderItem)),
                'net_amount' => $this->roundAmt($this->getNetAmountItem($orderItem)),
                'discount_amount' => $this->roundAmt($this->getDiscountAmountItem($orderItem)),
                'tax_amount' => $this->roundAmt($this->getTaxAmountItem($orderItem)),
                'tax_class_name' => 'VAT ' . $this->roundAmt($orderItem->getTaxPercent()) . '%',
                'tax_rate' => $this->roundAmt(($orderItem->getTaxPercent() / 100)),
                'unit_price' => $this->roundAmt($this->getUnitPriceItem($orderItem)),
                'quantity' => $item->getQty(),
                'quantity_unit' => $this->configRepository->getWeightUnit((int)$order->getStoreId()),
                'image_url' => $this->getProductImageUrl($product),
                'product_page_url' => $product->getProductUrl(),
                'type' => $orderItem->getIsVirtual() ? 'DIGITAL' : 'PHYSICAL',
                'details' => [
                    'barcodes' => [
                        [
                            'type' => 'SKU',
                            'value' => $item->getSku(),
                        ],
                    ],
                    'categories' => $this->getCategories($product->getCategoryIds()),
                ],
            ];
        }

        // Add shipping amount as orderLine on first shipment
        $firstShipmentId = $order->getShipmentsCollection()->getFirstItem()->getId();
        if ($firstShipmentId == $shipment->getId() && $order->getShippingAmount() > 0) {
            $items['shipping'] = $this->getShippingLineOrder($order);
        }

        return $this->lineItemsProcessor->execute($items);
    }

    /**
     * @param ShipmentInterface $shipment
     * @param array $orderItems
     * @return array
     */
    private function getRemainingItems(ShipmentInterface $shipment, array $orderItems): array
    {
        /** @var ShipmentItemInterface $shipmentItem */
        foreach ($shipment->getAllItems() as $shipmentItem) {
            /** @var OrderItemInterface $orderItem */
            $orderShipmentItem = $shipmentItem->getOrderItem();
            $remaining = $orderShipmentItem->getQtyToShip();

            // find order item
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

            $orderItems[$orderShipmentItemId] = $item;
        }

        // Remove Shipping cost line from remaining items if it is set
        foreach ($orderItems as $k => $v) {
            if ($v['order_item_id'] == 'shipping') {
                unset($orderItems[$k]);
            }
        }

        return $orderItems;
    }
}

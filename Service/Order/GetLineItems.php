<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service\Order;

use Magento\Framework\Exception\LocalizedException;
use Magento\Sales\Model\Order;
use Two\Gateway\Service\Order as OrderService;

/**
 * Get Line Items Service
 */
class GetLineItems extends OrderService
{
    /**
     * Get line items from order
     *
     * @param Order $order
     * @return array
     * @throws LocalizedException
     */
    public function execute(Order $order): array
    {
        $items = [];
        foreach ($order->getAllVisibleItems() as $item) {
            /** @var Order\Item $item */
            $product = $item->getProduct();
            $parentItem = $item->getParentItem()
                ?: ($item->getParentItemId() ? $order->getItemById($item->getParentItemId()) : null);
            if (!$product || $this->shouldSkip($parentItem, $item)) {
                continue;
            }

            if (isset($parentItem)) {
                $product = $parentItem->getProduct();
            }

            $productData = [
                'description' => '',
                'details' => [
                    'barcodes' => [
                        [
                            'type' => 'SKU',
                            'value' => $item->getSku(),
                        ],
                    ],
                    'categories' => $this->getCategories($product->getCategoryIds()),
                ],
                'discount_amount' => $this->roundAmt(abs((float)$item->getDiscountAmount())),
                'gross_amount' => $this->roundAmt($item->getRowTotalInclTax()),
                'image_url' => $this->getProductImageUrl($product),
                'name' => $item->getName(),
                'net_amount' => $this->roundAmt($item->getRowTotal()),
                'product_page_url' => $product->getProductUrl(),
                'quantity' => $item->getQtyOrdered(),
                'qty_to_ship' => $item->getQtyToShip(), //need for partial shipment
                'quantity_unit' => $this->configRepository->getWeightUnit((int)$order->getStoreId()),
                'tax_amount' => $this->roundAmt(abs((float)$item->getTaxAmount())),
                'tax_class_name' => '',
                'tax_rate' => $this->roundAmt(($item->getTaxPercent() / 100)),
                'type' => $item->getIsVirtual() ? 'DIGITAL' : 'PHYSICAL',
                'unit_price' => $this->roundAmt($item->getPrice()),
                'order_item_id' => $item->getId() //need for partial shipment
            ];
            $items[] = $productData;
        }

        if (!$order->getIsVirtual()) {
            $shippingAmount = $order->getShippingAmount();
            if ($shippingAmount == 0) {
                $shippingAmount = 1;
            }
            $items[] = [
                'name' => 'Shipping - ' . $order->getShippingDescription(),
                'description' => '',
                'gross_amount' => $this->roundAmt($order->getShippingInclTax()),
                'net_amount' => $this->roundAmt($order->getShippingInclTax() -
                    abs((float)$order->getShippingTaxAmount())),
                'discount_amount' => $this->roundAmt(abs((float)$order->getShippingDiscountAmount())),
                'tax_amount' => $this->roundAmt(abs((float)$order->getShippingTaxAmount())),
                'tax_class_name' => '',
                'tax_rate' => $this->roundAmt((1.0 * $order->getShippingTaxAmount() / $shippingAmount)),
                'unit_price' => $this->roundAmt($order->getShippingInclTax() -
                    abs((float)$order->getShippingTaxAmount())),
                'quantity' => (float)1,
                'qty_to_ship' => 1, //need for partial shipment
                'quantity_unit' => 'sc',
                'image_url' => '',
                'product_page_url' => '',
                'type' => 'SHIPPING_FEE',
                'order_item_id' => 'shipping' //need for partial shipment
            ];
        }

        return $items;
    }
}

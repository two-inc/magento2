<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service\Order;

use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Creditmemo;
use Two\Gateway\Service\Order as OrderService;
use Two\Gateway\Service\LineItemsProcessor;

/**
 * Compose Refund Service
 */
class ComposeRefund extends OrderService
{

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
        $linesItems = array_values($this->getLineItemsCreditmemo($order, $creditmemo));
        return [
            'amount' => $this->roundAmt($amount) * -1,
            'currency' => $order->getOrderCurrencyCode(),
            'initiate_payment_to_buyer' => true,
            'tax_subtotals' => $this->getTaxSubtotals($linesItems),
            'line_items' => array_values($this->getLineItemsCreditmemo($order, $creditmemo)),
        ];
    }

    /**
     * Get line items from creditmemo
     *
     * @param Order $order
     * @param Creditmemo $creditmemo
     * @return array
     * @throws NoSuchEntityException
     * @throws LocalizedException
     */
    public function getLineItemsCreditmemo(Order $order, Creditmemo $creditmemo): array
    {
        $items = [];
        foreach ($creditmemo->getItems() as $item) {
            $orderItem = $this->getOrderItem((int)$item->getOrderItemId());
            if (!$item->getRowTotal() || !$product = $this->getProduct($order, $orderItem)) {
                continue;
            }

            // Part of the item line that is shipped.
            $part = $orderItem->getQtyOrdered() / $item->getQty();

            $items[$orderItem->getItemId()] = [
                'order_item_id' => $item->getOrderItemId(),
                'name' => $item->getName(),
                'description' => $item->getName(),
                'gross_amount' => $this->roundAmt($this->getGrossAmountItem($orderItem) / $part) * -1,
                'net_amount' => $this->roundAmt($this->getNetAmountItem($orderItem) / $part) * -1,
                'tax_amount' => $this->roundAmt($this->getTaxAmountItem($orderItem) / $part) * -1,
                'discount_amount' => $this->roundAmt($this->getDiscountAmountItem($orderItem) / $part) * -1,
                'unit_price' => $this->roundAmt($this->getUnitPriceItem($orderItem)) * -1,
                'tax_rate' => $this->roundAmt(($orderItem->getTaxPercent() / 100)),
                'tax_class_name' => 'VAT ' . $this->roundAmt($orderItem->getTaxPercent()) . '%',
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
                ]
            ];
        }

        if (!$order->getIsVirtual() && $creditmemo->getShippingAmount()) {
            $items['shipping'] = [
                'name' => 'Shipping - ' . $order->getShippingDescription(),
                'description' => '',
                'type' => 'SHIPPING_FEE',
                'image_url' => '',
                'product_page_url' => '',
                'gross_amount' => $this->roundAmt($this->getGrossAmountShipping($creditmemo)) * -1,
                'net_amount' => $this->roundAmt($this->getNetAmountShipping($creditmemo)) * -1,
                'tax_amount' => $this->roundAmt($this->getTaxAmountShipping($creditmemo)) * -1,
                'discount_amount' => $this->roundAmt($this->getDiscountAmountShipping($creditmemo)) * -1,
                'unit_price' => $this->roundAmt($this->getUnitPriceShipping($creditmemo)) * -1,
                'tax_rate' => $this->roundAmt($this->getTaxRateShipping($creditmemo)),
                'tax_class_name' => 'VAT ' . $this->roundAmt($this->getTaxRateShipping($creditmemo) * 100) . '%',
                'quantity' => 1,
                'quantity_unit' => 'sc',
            ];
        }

        return $items;
    }
}

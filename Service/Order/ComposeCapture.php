<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service\Order;

use Exception;
use Magento\Framework\Exception\LocalizedException;
use Magento\Sales\Model\Order;
use Two\Gateway\Service\Order as OrderService;

/**
 * Compose Capture Service
 */
class ComposeCapture extends OrderService
{

    /**
     * Compose request body for two capture order
     *
     * @param Order $order
     * @param int $daysOnInvoice
     * @param Order\Invoice $invoice
     * @param string|null $twoOriginalOrderId
     * @return array
     * @throws LocalizedException
     */
    public function execute(
        Order $order,
        int $daysOnInvoice,
        Order\Invoice $invoice,
        ?string $twoOriginalOrderId = ''
    ): array {
        try {
            // Get the order taxes
            $taxRate = 0;
            $billingAddress = $order->getBillingAddress();
            $shippingAddress = $order->getShippingAddress();
            $shipment = $order->getShipment();
            $trackNumber = '';
            $carrierName = '';
            if ($shipment) {
                $tracksCollection = $shipment->getTracksCollection();
                foreach ($tracksCollection->getItems() as $track) {
                    $trackNumber = $track->getTrackNumber();
                    $carrierName = $track->getTitle();
                }
            }

            $reqBody = [
                'currency' => $invoice->getOrderCurrencyCode(),
                'gross_amount' => ($this->roundAmt($invoice->getGrandTotal())),
                'net_amount' => ($this->roundAmt($invoice->getGrandTotal() - abs($invoice->getTaxAmount()))),
                'tax_amount' => ($this->roundAmt($invoice->getTaxAmount())),
                'tax_rate' => $this->roundAmt((1.0 * $order->getTaxAmount() / $order->getGrandTotal())),
                'discount_amount' => (string)($this->roundAmt(abs($invoice->getDiscountAmount()))),
                'discount_rate' => '0',
                'invoice_type' => 'FUNDED_INVOICE',
                'line_items' => $this->getInvoiceLineItems($invoice->getItems(), $order),
                'merchant_order_id' => (string)($order->getIncrementId()),
                'merchant_reference' => '',
                'merchant_additional_info' => '',
                'invoice_details' => [
                    'due_in_days' => (int)$daysOnInvoice,
                    'payment_reference_message' => '',
                    'payment_reference_ocr' => '',
                ],
                'billing_address' => [
                    'city' => $billingAddress->getCity(),
                    'country' => $billingAddress->getCountryId(),
                    'organization_name' => $billingAddress->getCompany(),
                    'postal_code' => $billingAddress->getPostcode(),
                    'region' => ($billingAddress->getRegion() != '') ? $billingAddress->getRegion() : '',
                    'street_address' => $billingAddress->getStreet()[0] .
                        (isset($billingAddress->getStreet()[1]) ? $billingAddress->getStreet()[1] : '')
                ],
            ];

            if (!$order->getIsVirtual()) {
                $reqBody['shipping_address'] = [
                    'city' => ($shippingAddress) ? $shippingAddress->getCity() : '',
                    'country' => ($shippingAddress) ? $shippingAddress->getCountryId() : '',
                    'organization_name' => ($shippingAddress) ? $shippingAddress->getCompany() : '',
                    'postal_code' => ($shippingAddress) ? $shippingAddress->getPostcode() : '',
                    'region' => ($shippingAddress && $shippingAddress->getRegion() != '') ?
                        $shippingAddress->getRegion() : '',
                    'street_address' => ($shippingAddress) ? $shippingAddress->getStreet()[0] .
                        (isset($shippingAddress->getStreet()[1]) ? $shippingAddress->getStreet()[1] : '') : ''
                ];
                $reqBody['shipping_details'] = [
                    'carrier_name' => $carrierName,
                    'tracking_number' => $trackNumber,
                    'expected_delivery_date' => date('Y-m-d', strtotime('+ 7 days'))
                ];
            } else {
                $reqBody['shipping_address'] = [
                    'city' => $billingAddress->getCity(),
                    'country' => $billingAddress->getCountryId(),
                    'organization_name' => $billingAddress->getCompany(),
                    'postal_code' => $billingAddress->getPostcode(),
                    'region' => ($billingAddress->getRegion() != '') ? $billingAddress->getRegion() : '',
                    'street_address' => $billingAddress->getStreet()[0]
                        . (
                        isset($billingAddress->getStreet()[1])
                            ? $billingAddress->getStreet()[1] : ''
                        )
                ];
            }

            if ($twoOriginalOrderId) {
                $reqBody['original_order_id'] = $twoOriginalOrderId;
            }
            return $reqBody;
        } catch (Exception $e) {
            throw new LocalizedException(__($e->getMessage()));
        }
    }

    /**
     * Get Invoice Line Items
     *
     * @param array $lineItems
     * @param Order $order
     * @return array
     * @throws LocalizedException
     */
    public function getInvoiceLineItems(array $lineItems, Order $order): array
    {
        $items = [];

        foreach ($lineItems as $item) {
            if ($item->getQty() > 0) {
                $orderItem = $order->getItemById($item->getOrderItemId());

                $product = $orderItem->getProduct();

                $parentItem = $orderItem->getParentItem()
                    ?: ($orderItem->getParentItemId() ? $order->getItemById($orderItem->getParentItemId()) : null);

                if ($this->shouldSkip($parentItem, $orderItem)) {
                    continue;
                }
                if (isset($parentItem)) {
                    $product = $parentItem->getProduct();
                }

                $productData = [
                    'name' => $item->getName(),
                    'description' => substr($item->getDescription(), 0, 255),
                    'gross_amount' => (string)(
                    $this->roundAmt(
                        $item->getRowTotal() - abs($item->getDiscountAmount()) + $item->getTaxAmount()
                    )
                    ),
                    'net_amount' => (string)(
                    $this->roundAmt($item->getRowTotal() - abs($item->getDiscountAmount()))
                    ),
                    'discount_amount' => $this->roundAmt(abs($item->getDiscountAmount())),
                    'tax_amount' => $this->roundAmt($item->getTaxAmount()),
                    'tax_class_name' => 'VAT ' . $this->roundAmt($orderItem->getTaxPercent()) . '%',
                    'tax_rate' => $this->roundAmt(($orderItem->getTaxPercent() / 100)),
                    'unit_price' => $this->roundAmt($item->getPrice()),
                    'quantity' => $item->getQty(),
                    'quantity_unit' => 'item',
                    'image_url' => $this->getProductImageUrl($product),
                    'product_page_url' => $product->getProductUrl(),
                    'type' => 'PHYSICAL',
                    'details' => [
                        'barcodes' => [
                            [
                                'type' => 'SKU',
                                'value' => $item->getSku(),
                            ]
                        ],
                        'categories' => $this->getCategories($product->getCategoryIds()),
                    ]
                ];

                $items[] = $productData;
            }
        }

        if ($order->getShippingAmount() != 0) {
            $taxRate = round((1.0 * $order->getShippingTaxAmount() / $order->getShippingAmount()), 6);
            $shipping_line = [
                'name' => 'Shipping - ' . $order->getShippingMethod(),
                'description' => '',
                'gross_amount' => $this->roundAmt($order->getShippingAmount()),
                'net_amount' => (string)(
                $this->roundAmt($order->getShippingAmount() - $order->getShippingTaxAmount())
                ),
                'discount_amount' => '0',
                'tax_amount' => $this->roundAmt($order->getShippingTaxAmount()),
                'tax_class_name' => 'VAT ' . $this->roundAmt($taxRate * 100) . '%',
                'tax_rate' => (string)($taxRate),
                'unit_price' => $this->roundAmt($order->getShippingAmount()),
                'quantity' => 1,
                'quantity_unit' => 'sc', // shipment charge
                'image_url' => '',
                'product_page_url' => '',
                'type' => 'SHIPPING_FEE'
            ];

            $items[] = $shipping_line;
        }

        return $items;
    }
}

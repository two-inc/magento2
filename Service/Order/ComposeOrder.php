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
use Magento\Framework\Url;
use Magento\Sales\Model\Order;
use Magento\Store\Model\App\Emulation;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Service\Order as OrderService;

/**
 * Compose Order Service
 */
class ComposeOrder extends OrderService
{
    /**
     * @var GetLineItems
     */
    private $getLineItems;

    /**
     * ComposeOrder constructor.
     *
     * @param Image $imageHelper
     * @param ConfigRepository $configRepository
     * @param CategoryCollection $categoryCollectionFactory
     * @param Emulation $appEmulation
     * @param Url $url
     * @param GetLineItems $getLineItems
     */
    public function __construct(
        Image $imageHelper,
        ConfigRepository $configRepository,
        CategoryCollection $categoryCollectionFactory,
        Emulation $appEmulation,
        Url $url,
        GetLineItems $getLineItems
    ) {
        parent::__construct($imageHelper, $configRepository, $categoryCollectionFactory, $appEmulation, $url);
        $this->getLineItems = $getLineItems;
    }

    /**
     * Compose request body for two create order
     *
     * @param Order $order
     * @param string $orderReference
     * @param array $additionalData
     * @return array
     * @throws LocalizedException
     */
    public function execute(
        Order $order,
        string $orderReference,
        array $additionalData
    ): array {
        $billingAddress = $order->getBillingAddress();
        $storeId = (int)$order->getStoreId();

        $request = [
            'billing_address' => [
                'city' => $billingAddress->getCity(),
                'country' => $billingAddress->getCountryId(),
                'organization_name' => $additionalData['companyName'],
                'postal_code' => $billingAddress->getPostcode(),
                'region' => ($billingAddress->getRegion() != '') ? $billingAddress->getRegion() : '',
                'street_address' => $billingAddress->getStreet()[0]
                    . (isset($billingAddress->getStreet()[1]) ? $billingAddress->getStreet()[1] : ''),
            ],
            'buyer' => [
                'representative' => [
                    'email' => $billingAddress->getEmail(),
                    'first_name' => $billingAddress->getFirstName(),
                    'last_name' => $billingAddress->getLastName(),
                    'phone_number' => $additionalData['telephone'] ?? $billingAddress->getTelephone(),
                ],
                'company' => [
                    'organization_number' => $additionalData['companyId'],
                    'country_prefix' => $billingAddress->getCountryId(),
                    'company_name' => $additionalData['companyName'],
                ],

            ],
            'buyer_department' => $additionalData['department'] ?? '',
            'buyer_project' => $additionalData['project'] ?? '',
            'buyer_purchase_order_number' => $additionalData['poNumber'] ?? '',

            'currency' => $order->getOrderCurrencyCode(),
            'discount_amount' => $this->roundAmt(abs($order->getDiscountAmount())),
            'gross_amount' => $this->roundAmt($order->getGrandTotal()),

            'invoice_details' => [
                'due_in_days' => $this->configRepository->getDueInDays($storeId),
                'payment_reference_message' => '',
                'payment_reference_ocr' => '',
            ],
            'invoice_type' => 'FUNDED_INVOICE',

            'line_items' => $this->getLineItems->execute($order),

            'merchant_order_id' => (string)($order->getIncrementId()),
            'merchant_urls' => [
                'merchant_confirmation_url' => $this->url->getUrl(
                    'two/payment/confirm',
                    ['_two_order_reference' => base64_encode($orderReference)]
                ),
                'merchant_cancel_order_url' => $this->url->getUrl(
                    'two/payment/cancel',
                    ['_two_order_reference' => base64_encode($orderReference)]
                ),
                'merchant_edit_order_url' => '',
                'merchant_order_verification_failed_url' => $this->url->getUrl(
                    'two/payment/verificationfailed',
                    ['_two_order_reference' => base64_encode($orderReference)]
                ),
            ],
            'net_amount' => $this->roundAmt($order->getGrandTotal() - abs($order->getTaxAmount())),
            'tax_amount' => $this->roundAmt(abs($order->getTaxAmount())),
            'tax_rate' => $this->roundAmt((1.0 * $order->getTaxAmount() / $order->getGrandTotal())),
            'order_note' => $additionalData['orderNote'] ?? ''
        ];
        if (!$order->getIsVirtual()) {
            $shippingAddress = $order->getShippingAddress();
        } else {
            $shippingAddress = $billingAddress;
        }

        $request['shipping_address'] = [
            'city' => $shippingAddress->getCity(),
            'country' => $shippingAddress->getCountryId(),
            'organization_name' => $additionalData['companyName'],
            'postal_code' => $shippingAddress->getPostcode(),
            'region' => ($shippingAddress->getRegion() != '') ? $shippingAddress->getRegion() : '',
            'street_address' => $shippingAddress->getStreet()[0]
                . (isset($shippingAddress->getStreet()[1]) ? $shippingAddress->getStreet()[1] : ''),
        ];
        return $request;
    }
}

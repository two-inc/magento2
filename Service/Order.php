<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service;

use Exception;
use Magento\Bundle\Model\Product\Price;
use Magento\Catalog\Helper\Image;
use Magento\Catalog\Model\Product;
use Magento\Catalog\Model\ResourceModel\Category\Collection;
use Magento\Catalog\Model\ResourceModel\Category\CollectionFactory as CategoryCollection;
use Magento\Framework\App\Area;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Url;
use Magento\Sales\Api\Data\OrderItemInterface;
use Magento\Sales\Api\OrderItemRepositoryInterface;
use Magento\Sales\Model\Order as OrderModel;
use Magento\Sales\Model\Order\Creditmemo as CreditmemoModel;
use Magento\Sales\Model\Order\Creditmemo\Item as CreditmemoItem;
use Magento\Sales\Model\Order\Invoice\Item as InvoiceItem;
use Magento\Sales\Model\Order\Item as OrderItem;
use Magento\Store\Model\App\Emulation;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;

/**
 * Abstract order class
 */
abstract class Order
{
    /**
     * @var ConfigRepository
     */
    public $configRepository;
    /**
     * @var Url
     */
    public $url;
    /**
     * @var CategoryCollection
     */
    private $categoryCollectionFactory;
    /**
     * @var Emulation
     */
    private $appEmulation;
    /**
     * @var Image
     */
    private $imageHelper;
    /**
     * @var OrderItemRepositoryInterface
     */
    private $orderItemRepository;
    /**
     * @var LineItemsProcessor
     */
    protected $lineItemsProcessor;

    /**
     * Order constructor.
     *
     * @param Image $imageHelper
     * @param ConfigRepository $configRepository
     * @param CategoryCollection $categoryCollectionFactory
     * @param OrderItemRepositoryInterface $orderItemRepository
     * @param Emulation $appEmulation
     * @param Url $url
     * @param LineItemsProcessor $lineItemsProcessor
     */
    public function __construct(
        Image $imageHelper,
        ConfigRepository $configRepository,
        CategoryCollection $categoryCollectionFactory,
        OrderItemRepositoryInterface $orderItemRepository,
        Emulation $appEmulation,
        Url $url,
        LineItemsProcessor $lineItemsProcessor
    ) {
        $this->imageHelper = $imageHelper;
        $this->configRepository = $configRepository;
        $this->categoryCollectionFactory = $categoryCollectionFactory;
        $this->orderItemRepository = $orderItemRepository;
        $this->appEmulation = $appEmulation;
        $this->url = $url;
        $this->lineItemsProcessor = $lineItemsProcessor;
    }

    /**
     * Check if item should be skipped
     *
     * @param mixed $parentItem
     * @param mixed $item
     * @return bool
     */
    public function shouldSkip($parentItem, $item): bool
    {
        // Skip if bundle product with a dynamic price type
        if (Product\Type::TYPE_BUNDLE == $item->getProductType()
            && Price::PRICE_TYPE_DYNAMIC == $item->getProduct()->getPriceType()
        ) {
            return true;
        }

        if (!$parentItem) {
            return false;
        }

        // Skip if child product of a non bundle parent
        if (Product\Type::TYPE_BUNDLE != $parentItem->getProductType()) {
            return true;
        }

        // Skip if non bundle product or if bundled product with a fixed price type
        if (Product\Type::TYPE_BUNDLE != $parentItem->getProductType()
            || Price::PRICE_TYPE_FIXED == $parentItem->getProduct()->getPriceType()
        ) {
            return true;
        }

        return false;
    }

    /**
     * @param OrderModel $order
     * @param OrderModel\Item $item
     * @return Product|null
     */
    public function getProduct(OrderModel $order, OrderModel\Item $item): ?Product
    {
        $product = $item->getProduct();
        $parentItem = $this->getParentItem($item, $order);
        if (!$product || $this->shouldSkip($parentItem, $item)) {
            return null;
        }

        return $parentItem ? $parentItem->getProduct() : $product;
    }

    /**
     * @param OrderModel\Item $item
     * @param OrderModel $order
     * @return OrderModel\Item|null
     */
    public function getParentItem(OrderModel\Item $item, OrderModel $order): ?OrderModel\Item
    {
        return $item->getParentItem()
            ?: ($item->getParentItemId() ? $order->getItemById($item->getParentItemId()) : null);
    }

    /**
     * @param int $itemId
     * @return OrderItemInterface
     */
    public function getOrderItem(int $itemId): OrderItemInterface
    {
        return $this->orderItemRepository->get($itemId);
    }

    /**
     * Get line items from order
     *
     * @param OrderModel $order
     * @return array
     * @throws LocalizedException
     */
    public function getLineItemsOrder(OrderModel $order): array
    {
        $items = [];
        foreach ($order->getAllVisibleItems() as $item) {
            if (!$product = $this->getProduct($order, $item)) {
                continue;
            }
            $items[] = [
                'order_item_id' => $item->getId(),
                'name' => $item->getName(),
                'description' => $item->getName(),
                'type' => $item->getIsVirtual() ? 'DIGITAL' : 'PHYSICAL',
                'image_url' => $this->getProductImageUrl($product),
                'product_page_url' => $product->getProductUrl(),
                'gross_amount' => $this->roundAmt($this->getGrossAmountItem($item)),
                'net_amount' => $this->roundAmt($this->getNetAmountItem($item)),
                'tax_amount' => $this->roundAmt($this->getTaxAmountItem($item)),
                'discount_amount' => $this->roundAmt($this->getDiscountAmountItem($item)),
                'tax_rate' => $this->roundAmt(($item->getTaxPercent() / 100)),
                'tax_class_name' => 'VAT ' . $this->roundAmt($item->getTaxPercent()) . '%',
                'unit_price' => $this->roundAmt($this->getUnitPriceItem($item)),
                'quantity' => $item->getQtyOrdered(),
                'qty_to_ship' => $item->getQtyToShip(), //need for partial shipment
                'quantity_unit' => $this->configRepository->getWeightUnit((int)$order->getStoreId()),
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

        if (!$order->getIsVirtual() && $order->getShippingAmount() > 0) {
            $items[] = $this->getShippingLineOrder($order);
        }

        $netAmount = (float)$this->roundAmt($order->getGrandTotal() - $order->getTaxAmount());
        return $this->lineItemsProcessor->execute($items, $netAmount);
    }

    /**
     * Get product image
     *
     * @param Product $product
     * @return string
     */
    public function getProductImageUrl(Product $product): string
    {
        try {
            $this->appEmulation->startEnvironmentEmulation($product->getStoreId(), Area::AREA_FRONTEND, true);
            return $this->imageHelper->init($product, 'product_small_image')->getUrl();
        } catch (Exception $exception) {
            return '';
        } finally {
            $this->appEmulation->stopEnvironmentEmulation();
        }
    }

    /**
     * Format price
     *
     * @param mixed $amt
     * @return string
     */
    public function roundAmt($amt): string
    {
        return number_format((float)$amt, 2, '.', '');
    }

    /**
     * @param OrderItem|InvoiceItem|CreditmemoItem $item
     * @return float
     */
    public function getGrossAmountItem($item): float
    {
        return (float)($this->getNetAmountItem($item) + $this->getTaxAmountItem($item));
    }

    /**
     * @param OrderItem|InvoiceItem|CreditmemoItem $item
     * @return float
     */
    public function getNetAmountItem($item): float
    {
        $qty = $item instanceof OrderItem
            ? $item->getQtyOrdered()
            : $item->getQty();

        return (float)(
            ($qty * $this->getUnitPriceItem($item)) - $this->getDiscountAmountItem($item)
        );
    }

    /**
     * @param OrderItem|InvoiceItem|CreditmemoItem $item
     * @return float
     */
    public function getUnitPriceItem($item): float
    {
        return $item->getPrice();
    }

    /**
     * @param OrderItem|InvoiceItem|CreditmemoItem $item
     * @return float
     */
    public function getTaxAmountItem($item): float
    {
        return (float)$item->getTaxAmount();
    }

    /**
     * @param OrderItem|InvoiceItem|CreditmemoItem $item
     * @return float
     */
    public function getDiscountAmountItem($item): float
    {
        return (float)$item->getDiscountAmount();
    }

    /**
     * @param OrderItem|InvoiceItem|CreditmemoItem $item
     * @return float
     */
    private function getDiscountTaxCompensationAmount($item)
    {
        return (float)($item->getDiscountAmount() * $item->getTaxPercent() / 100);
    }

    /**
     * Get category array by category ids
     *
     * @param array $categoryIds
     * @return array
     * @throws LocalizedException
     */
    public function getCategories(array $categoryIds): array
    {
        $categories = [];
        if (!$categoryIds) {
            return $categories;
        }

        foreach ($this->getCategoryCollection($categoryIds) as $category) {
            $categories[] = $category->getName();
        }

        return $categories;
    }

    /**
     * Get category collection
     * @param $categoryIds
     * @return Collection
     */
    private function getCategoryCollection($categoryIds): Collection
    {
        return $this->categoryCollectionFactory->create()
            ->addAttributeToSelect('name')
            ->addAttributeToFilter('entity_id', $categoryIds)
            ->addIsActiveFilter();
    }

    /**
     * @param OrderModel $order
     * @return array
     */
    public function getShippingLineOrder(OrderModel $order): array
    {
        return [
            'order_item_id' => 'shipping',
            'name' => 'Shipping - ' . $order->getShippingDescription(),
            'description' => '',
            'type' => 'SHIPPING_FEE',
            'image_url' => '',
            'product_page_url' => '',
            'gross_amount' => $this->roundAmt($this->getGrossAmountShipping($order)),
            'net_amount' => $this->roundAmt($this->getNetAmountShipping($order)),
            'tax_amount' => $this->roundAmt($this->getTaxAmountShipping($order)),
            'discount_amount' => $this->roundAmt($this->getDiscountAmountShipping($order)),
            'tax_rate' => $this->roundAmt($this->getTaxRateShipping($order)),
            'unit_price' => $this->roundAmt($this->getUnitPriceShipping($order)),
            'tax_class_name' => 'VAT ' . $this->roundAmt($this->getTaxRateShipping($order) * 100) . '%',
            'quantity' => 1,
            'qty_to_ship' => 1, //need for partial shipment
            'quantity_unit' => 'sc',
        ];
    }

    /**
     * @param OrderModel|CreditmemoModel $entity
     * @return float
     */
    public function getGrossAmountShipping($entity): float
    {
        return (float)($this->getNetAmountShipping($entity) + $this->getTaxAmountShipping($entity));
    }

    /**
     * @param OrderModel|CreditmemoModel $entity
     * @return float
     */
    public function getNetAmountShipping($entity): float
    {
        return (float)(
            $this->getUnitPriceShipping($entity) - $this->getDiscountAmountShipping($entity)
        );
    }

    /**
     * @param OrderModel|CreditmemoModel $entity
     * @return float
     */
    public function getUnitPriceShipping($entity): float
    {
        return (float)$entity->getShippingInclTax() - $entity->getShippingTaxAmount();
    }

    /**
     * @param OrderModel|CreditmemoModel $entity
     * @return float
     */
    public function getDiscountAmountShipping($entity): float
    {
        return (float)$entity->getShippingDiscountAmount();
    }

    /**
     * @param OrderModel|CreditmemoModel $entity
     * @return float
     */
    public function getTaxAmountShipping($entity): float
    {
        return (float)($entity->getShippingTaxAmount());
    }

    /**
     * @param OrderModel|CreditmemoModel $entity
     * @return float
     */
    public function getTaxRateShipping($entity): float
    {
        return round(($entity->getShippingInclTax() / $entity->getShippingAmount()), 6) - 1;
    }

    /**
     * @param OrderModel $order
     * @param array|null $additionalData
     * @param string $type
     * @return array
     */
    public function getAddress(OrderModel $order, ?array $additionalData, string $type): array
    {
        $address = !$order->getIsVirtual() || $type != 'billing'
            ? $order->getShippingAddress()
            : $order->getBillingAddress();

        return [
            'city' => $address->getCity(),
            'country' => $address->getCountryId(),
            'organization_name' => !empty($additionalData['companyName'])
                ? $additionalData['companyName']
                : $address->getCompany(),
            'postal_code' => $address->getPostcode(),
            'region' => $address->getRegion() != '' ? $address->getRegion() : '',
            'street_address' => $address->getStreet()[0]
                . (isset($address->getStreet()[1]) ? $address->getStreet()[1] : ''),
        ];
    }

    /**
     * @param OrderModel $order
     * @param array|null $additionalData
     * @return array[]
     */
    public function getBuyer(OrderModel $order, ?array $additionalData): array
    {
        $billingAddress = $order->getBillingAddress();

        return [
            'representative' => [
                'email' => $billingAddress->getEmail(),
                'first_name' => $billingAddress->getFirstName(),
                'last_name' => $billingAddress->getLastName(),
                'phone_number' => $additionalData['telephone'] ?? $billingAddress->getTelephone(),
            ],
            'company' => [
                'organization_number' => $additionalData['companyId'] ?? '',
                'country_prefix' => $billingAddress->getCountryId(),
                'company_name' => !empty($additionalData['companyName'])
                    ? $additionalData['companyName']
                    : $billingAddress->getCompany(),
            ]
        ];
    }

    /**
     * @param array $linesItems
     * @return array
     */
    public function getTaxSubtotals(array $linesItems): array
    {
        $taxSubtotals = [];
        foreach ($linesItems as $linesItem) {
            $taxSubtotals[$linesItem['tax_rate']][] = [
                'tax_amount' => $linesItem['tax_amount'],
                'taxable_amount' => $linesItem['net_amount']
            ];
        }

        $summary = [];
        foreach ($taxSubtotals as $rate => $amounts) {
            $summary[] = [
                'tax_amount' => $this->getSum($amounts, 'tax_amount'),
                'taxable_amount' => $this->getSum($amounts, 'taxable_amount'),
                'tax_rate' => $this->roundAmt($rate)
            ];
        }

        return $summary;
    }

    /**
     * @param $itemsArray
     * @param $columnKey
     * @return string
     */
    public function getSum($itemsArray, $columnKey): string
    {
        return $this->roundAmt(
            array_sum(array_column($itemsArray, $columnKey))
        );
    }
}

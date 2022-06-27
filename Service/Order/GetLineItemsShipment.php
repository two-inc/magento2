<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service\Order;

use Magento\Catalog\Api\Data\ProductInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Catalog\Helper\Image;
use Magento\Catalog\Model\ResourceModel\Category\CollectionFactory as CategoryCollection;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\Url;
use Magento\Sales\Api\Data\OrderItemInterface;
use Magento\Sales\Api\OrderItemRepositoryInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Shipment\Item;
use Magento\Store\Model\App\Emulation;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Service\Order as OrderService;

/**
 * Get Line Items Shipment Service
 */
class GetLineItemsShipment extends OrderService
{
    /**
     * @var ProductRepositoryInterface
     */
    private $productRepository;

    /**
     * @var OrderItemRepositoryInterface
     */
    private $orderItemRepository;

    /**
     * GetLineItemsRefund constructor.
     *
     * @param ProductRepositoryInterface $productRepository
     * @param OrderItemRepositoryInterface $orderItemRepository
     * @param Image $imageHelper
     * @param ConfigRepository $configRepository
     * @param CategoryCollection $categoryCollectionFactory
     * @param Emulation $appEmulation
     * @param Url $url
     */
    public function __construct(
        ProductRepositoryInterface $productRepository,
        OrderItemRepositoryInterface $orderItemRepository,
        Image $imageHelper,
        ConfigRepository $configRepository,
        CategoryCollection $categoryCollectionFactory,
        Emulation $appEmulation,
        Url $url
    ) {
        parent::__construct($imageHelper, $configRepository, $categoryCollectionFactory, $appEmulation, $url);
        $this->productRepository = $productRepository;
        $this->orderItemRepository = $orderItemRepository;
    }

    /**
     * Get line items from shipment
     *
     * @param Order $order
     * @param Order\Shipment $shipment
     * @return array
     * @throws NoSuchEntityException
     * @throws LocalizedException
     */
    public function execute(Order $order, Order\Shipment $shipment): array
    {
        $items = [];
        foreach ($shipment->getAllItems() as $item) {
            /** @var Item $item */
            if (!$item->getQty()) {
                continue;
            }

            $product = $this->getProductById($item->getProductId());
            $orderItem = $this->getOrderItem($item->getOrderItemId());

            $parentItem = $orderItem->getParentItem()
                ?: ($orderItem->getParentItemId() ? $order->getItemById($orderItem->getParentItemId()) : null);
            if (!$product || $this->shouldSkip($parentItem, $item)) {
                continue;
            }

            $qtyOrdered = $orderItem->getQtyOrdered();
            $qtyShipped = $item->getQty();

            $items[$orderItem->getItemId()] = [
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
                'discount_amount' => $this->roundAmt(
                    (abs($orderItem->getDiscountAmount()) / $qtyOrdered) / $qtyShipped
                ),
                'gross_amount' => $this->roundAmt(($orderItem->getRowTotalInclTax() / $qtyOrdered) / $qtyShipped),
                'image_url' => $this->getProductImageUrl($product),
                'name' => $item->getName(),
                'net_amount' => $this->roundAmt(($orderItem->getRowTotal() / $qtyOrdered) / $qtyShipped),
                'product_page_url' => $product->getProductUrl(),
                'quantity' => $item->getQty(),
                'quantity_unit' => $this->configRepository->getWeightUnit((int)$order->getStoreId()),
                'tax_amount' => $this->roundAmt((abs($orderItem->getTaxAmount()) / $qtyOrdered) / $qtyShipped),
                'tax_class_name' => '',
                'tax_rate' => $this->roundAmt(($orderItem->getTaxPercent() / 100)),
                'type' => $orderItem->getIsVirtual() ? 'DIGITAL' : 'PHYSICAL',
                'unit_price' => $this->roundAmt($orderItem->getPrice()),
            ];
        }

        return $items;
    }

    /**
     * @param $id
     * @return ProductInterface
     * @throws NoSuchEntityException
     */
    private function getProductById($id): ProductInterface
    {
        return $this->productRepository->getById($id);
    }

    /**
     * @param $itemId
     * @return OrderItemInterface
     */
    private function getOrderItem($itemId): OrderItemInterface
    {
        return $this->orderItemRepository->get($itemId);
    }
}

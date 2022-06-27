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
use Magento\Catalog\Model\Product\Type;
use Magento\Catalog\Model\ResourceModel\Category\Collection;
use Magento\Catalog\Model\ResourceModel\Category\CollectionFactory as CategoryCollection;
use Magento\Framework\App\Area;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Url;
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
     * Order constructor.
     *
     * @param Image $imageHelper
     * @param ConfigRepository $configRepository
     * @param CategoryCollection $categoryCollectionFactory
     * @param Emulation $appEmulation
     * @param Url $url
     */
    public function __construct(
        Image $imageHelper,
        ConfigRepository $configRepository,
        CategoryCollection $categoryCollectionFactory,
        Emulation $appEmulation,
        Url $url
    ) {
        $this->imageHelper = $imageHelper;
        $this->configRepository = $configRepository;
        $this->categoryCollectionFactory = $categoryCollectionFactory;
        $this->appEmulation = $appEmulation;
        $this->url = $url;
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

        foreach ($this->getCategoryCollection()->addAttributeToFilter('entity_id', $categoryIds) as $category) {
            $categories[] = $category->getName();
        }

        return $categories;
    }

    /**
     * Get category collection
     *
     * @param bool $isActive
     * @param int|null $level
     * @param string|null $sortBy
     * @param int|null $pageSize
     * @return Collection
     */
    private function getCategoryCollection(
        bool $isActive = true,
        ?int $level = null,
        ?string $sortBy = null,
        ?int $pageSize = null
    ): Collection {
        $collection = $this->categoryCollectionFactory->create();
        $collection->addAttributeToSelect('*');

        // select only active categories
        if ($isActive) {
            $collection->addIsActiveFilter();
        }

        // select categories of certain level
        if ($level) {
            $collection->addLevelFilter($level);
        }

        // sort categories by some value
        if ($sortBy) {
            $collection->addOrderField($sortBy);
        }

        // select certain number of categories
        if ($pageSize) {
            $collection->setPageSize($pageSize);
        }

        return $collection;
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
     * Check if item should be skipped
     *
     * @param mixed $parentItem
     * @param mixed $item
     * @return bool
     */
    public function shouldSkip($parentItem, $item): bool
    {
        // Skip if bundle product with a dynamic price type
        if (Type::TYPE_BUNDLE == $item->getProductType()
            && Price::PRICE_TYPE_DYNAMIC == $item->getProduct()->getPriceType()
        ) {
            return true;
        }

        if (!$parentItem) {
            return false;
        }

        // Skip if child product of a non bundle parent
        if (Type::TYPE_BUNDLE != $parentItem->getProductType()) {
            return true;
        }

        // Skip if non bundle product or if bundled product with a fixed price type
        if (Type::TYPE_BUNDLE != $parentItem->getProductType()
            || Price::PRICE_TYPE_FIXED == $parentItem->getProduct()->getPriceType()
        ) {
            return true;
        }

        return false;
    }
}

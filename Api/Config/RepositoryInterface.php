<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Api\Config;

/**
 * Config Repository Interface
 */
interface RepositoryInterface
{
    /** Method code */
    public const CODE = 'two_payment';

    /** Endpoints */
    public const API_LIVE = 'https://api.two.inc';
    public const API_SANDBOX = 'https://sandbox.api.two.inc';

    /** Payment Group */
    public const XML_PATH_ENABLED = 'payment/two_payment/active';
    public const XML_PATH_TITLE = 'payment/two_payment/title';
    public const XML_PATH_MODE = 'payment/two_payment/mode';
    public const XML_PATH_MERCHANT_SHORT_NAME = 'payment/two_payment/merchant_short_name';
    public const XML_PATH_API_KEY = 'payment/two_payment/api_key';
    public const XML_PATH_DAYS_ON_INVOICE = 'payment/two_payment/days_on_invoice';
    public const XML_PATH_FULFILL_ORDER_ORDER = 'payment/two_payment/fulfill_order';
    public const XML_PATH_INTERNATIONAL_TELEPHONE_ENABLED = 'payment/two_payment/international_telephone_enabled';
    public const XML_PATH_COMPANY_NAME_AUTOCOMPLETE_ENABLED = 'payment/two_payment/company_autocomplete_enabled';
    public const XML_PATH_ENABLE_DEPARTMENT_NAME = 'payment/two_payment/enable_department';
    public const XML_PATH_ENABLE_PROJECT_NAME = 'payment/two_payment/enable_project';
    public const XML_PATH_ENABLE_ORDER_NOTE = 'payment/two_payment/enable_order_note';
    public const XML_PATH_ENABLE_PO_NUMBER = 'payment/two_payment/enable_po_number';
    public const XML_PATH_ENABLE_TWO_LINK = 'payment/two_payment/enable_two_link';
    public const XML_PATH_SHOW_TELEPHONE = 'payment/two_payment/show_telephone';
    public const XML_PATH_VERSION = 'payment/two_payment/version';
    public const XML_PATH_DEBUG = 'payment/two_payment/debug';
    public const XML_PATH_ENABLE_ADDRESS_AUTOCOMPLETE = 'payment/two_payment/enable_address_autocomplete';

    /** Weight unit */
    public const XML_PATH_WEIGHT_UNIT = 'general/locale/weight_unit';

    /**
     * Check if payment method is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isActive(?int $storeId = null): bool;

    /**
     * Get mode
     *
     * @param int|null $storeId
     *
     * @return string
     */
    public function getMode(?int $storeId = null): string;

    /**
     * Get merchant short name
     *
     * @param int|null $storeId
     *
     * @return string
     */
    public function getMerchantShortName(?int $storeId = null): string;

    /**
     * Get Api key
     *
     * @param int|null $storeId
     *
     * @return string
     */
    public function getApiKey(?int $storeId = null): string;

    /**
     * Check if debug mode is enabled
     *
     * @param int|null $storeId
     * @param string|null $scope
     *
     * @return bool
     */
    public function isDebugMode(int $storeId = null, ?string $scope = null): bool;

    /**
     * Get invoice due in days
     *
     * @param int|null $storeId
     *
     * @return int
     */
    public function getDueInDays(?int $storeId = null): int;

    /**
     * Get Fulfill Order Type (invoice or shipment)
     *
     * @param int|null $storeId
     *
     * @return string
     */
    public function getFulfillOrderType(?int $storeId = null): string;

    /**
     * Check if international telephone is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isInternationalTelephoneEnabled(?int $storeId = null): bool;

    /**
     * Check if company name autocomplete is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isCompanyAutocompleteEnabled(?int $storeId = null): bool;

    /**
     * Check if department is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isDepartmentEnabled(?int $storeId = null): bool;

    /**
     * Check if order note is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isOrderNoteEnabled(?int $storeId = null): bool;

    /**
     * Check if project is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isProjectEnabled(?int $storeId = null): bool;

    /**
     * Check if PO number is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isPONumberEnabled(?int $storeId = null): bool;

    /**
     * Check if TWO link is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isTwoLinkEnabled(?int $storeId = null): bool;

    /**
     * Get weight unit
     *
     * @param int|null $storeId
     *
     * @return string
     */
    public function getWeightUnit(?int $storeId = null): string;

    /**
     * Get route url
     *
     * @param string $route
     * @param array|null $params
     *
     * @return string
     */
    public function getUrls(string $route, ?array $params = []): string;

    /**
     * Get search host urls
     *
     * @return array
     */
    public function getSearchHostUrls(): array;

    /**
     * Get checkout host url
     *
     * @return string
     */
    public function getCheckoutHostUrl(): string;

    /**
     * Get Magento version
     *
     * @return string
     */
    public function getMagentoVersion(): string;

    /**
     * Get extension platform name
     *
     * @return string|null
     */
    public function getExtensionPlatformName(): ?string;

    /**
     * Get extension version
     *
     * @return string|null
     */
    public function getExtensionDBVersion(): ?string;

    /**
     * Add version data in url
     *
     * @param string $url
     * @return string
     */
    public function addVersionDataInURL(string $url): string;

    /**
     * Show telephone on billing or shipping page
     *
     * @param int|null $storeId = null
     * @return string
     */
    public function showTelephone(?int $storeId = null): string;

    /**
     * Check if address autocomplete is enabled
     *
     * @param int|null $storeId
     *
     * @return bool
     */
    public function isAddressAutocompleteEnabled(?int $storeId = null): bool;
}

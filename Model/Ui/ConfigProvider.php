<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Model\Ui;

use Magento\Checkout\Model\ConfigProviderInterface;
use Magento\Framework\View\Asset\Repository as AssetRepository;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Service\UrlCookie;

/**
 * Ui Config Provider
 */
class ConfigProvider implements ConfigProviderInterface
{
    /**
     * @var ConfigRepository
     */
    private $configRepository;

    /**
     * @var AssetRepository
     */
    private $assetRepository;

    /**
     * ConfigProvider constructor.
     *
     * @param ConfigRepository $configRepository
     * @param AssetRepository $assetRepository
     */
    public function __construct(
        ConfigRepository $configRepository,
        AssetRepository $assetRepository
    ) {
        $this->configRepository = $configRepository;
        $this->assetRepository = $assetRepository;
    }

    /**
     * Retrieve assoc array of checkout configuration
     *
     * @return array
     */
    public function getConfig(): array
    {
        $internationalTelephoneConfig = [];
        if ($this->configRepository->isInternationalTelephoneEnabled()) {
            $internationalTelephoneConfig['utilsScript'] =
                $this->assetRepository->getUrl('Two_Gateway::intl-tel-input-18.2.1/js/utils.js');
        }

        $companySearchConfig = [];
        if ($this->configRepository->isCompanySearchEnabled()) {
            $companySearchConfig['searchHosts'] = $this->configRepository->getSearchHostUrls();
            $companySearchConfig['searchLimit'] = 50;
        }

        $orderIntentConfig = [
            'extensionPlatformName' => $this->configRepository->getExtensionPlatformName(),
            'extensionDBVersion' => $this->configRepository->getExtensionDBVersion(),
            'invoiceType' => 'FUNDED_INVOICE',
            'merchantShortName' => $this->configRepository->getMerchantShortName(),
            'weightUnit' => $this->configRepository->getWeightUnit(),
        ];

        return [
            'payment' => [
                ConfigRepository::CODE => [
                    'checkoutApiUrl' => $this->configRepository->getCheckoutApiUrl(),
                    'checkoutPageUrl' => $this->configRepository->getCheckoutPageUrl(),
                    'redirectUrlCookieCode' => UrlCookie::COOKIE_NAME,
                    'isOrderIntentEnabled' => $this->configRepository->isOrderIntentEnabled(),
                    'orderIntentConfig' => $orderIntentConfig,
                    'isCompanySearchEnabled' => $this->configRepository->isCompanySearchEnabled(),
                    'isAddressSearchEnabled' => $this->configRepository->isAddressSearchEnabled(),
                    'companySearchConfig' => $companySearchConfig,
                    'isInternationalTelephoneEnabled' => $this->configRepository->isInternationalTelephoneEnabled(),
                    'showTelephone' => $this->configRepository->showTelephone(),
                    'supportedCountryCodes' => ['no', 'gb', 'se'],
                    'internationalTelephoneConfig' => $internationalTelephoneConfig,
                    'isDepartmentFieldEnabled' => $this->configRepository->isDepartmentEnabled(),
                    'isProjectFieldEnabled' => $this->configRepository->isProjectEnabled(),
                    'isOrderNoteFieldEnabled' => $this->configRepository->isOrderNoteEnabled(),
                    'isPONumberFieldEnabled' => $this->configRepository->isPONumberEnabled(),
                    'isTwoLinkEnabled' => $this->configRepository->isTwoLinkEnabled(),
                ],
            ],
        ];
    }
}

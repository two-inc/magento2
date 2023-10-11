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
                $this->assetRepository->getUrl('Two_Gateway::js/international-telephone/utils.js');
        }

        $companyAutoCompleteConfig = [];
        if ($this->configRepository->isCompanyAutocompleteEnabled()) {
            $companyAutoCompleteConfig['searchHosts'] = $this->configRepository->getSearchHostUrls();
            $companyAutoCompleteConfig['searchLimit'] = 50;
        }

        $intentOrderConfig = [
            'host' => $this->configRepository->getCheckoutHostUrl(),
            'extensionPlatformName' => $this->configRepository->getExtensionPlatformName(),
            'extensionDBVersion' => $this->configRepository->getExtensionDBVersion(),
            'invoiceType' => 'FUNDED_INVOICE',
            'merchantShortName' => $this->configRepository->getMerchantShortName(),
            'weightUnit' => $this->configRepository->getWeightUnit(),
        ];

        return [
            'payment' => [
                ConfigRepository::CODE => [
                    'api_url' => ($this->configRepository->getMode() == 'sandbox') ?
                        ConfigRepository::API_SANDBOX : ConfigRepository::API_LIVE,
                    'popup_url' => ($this->configRepository->getMode() == 'sandbox') ?
                        ConfigRepository::SOLETRADER_POPUP_SANDBOX : ConfigRepository::SOLETRADER_POPUP_LIVE,
                    'redirectUrlCookieCode' => UrlCookie::COOKIE_NAME,
                    'isOrderIntentEnabled' => 1,
                    'isCompanyNameAutoCompleteEnabled' => $this->configRepository->isCompanyAutocompleteEnabled(),
                    'isInternationalTelephoneEnabled' => $this->configRepository->isInternationalTelephoneEnabled(),
                    'showTelephone' => $this->configRepository->showTelephone(),
                    'isDepartmentFieldEnabled' => $this->configRepository->isDepartmentEnabled(),
                    'isProjectFieldEnabled' => $this->configRepository->isProjectEnabled(),
                    'isOrderNoteFieldEnabled' => $this->configRepository->isOrderNoteEnabled(),
                    'isPONumberFieldEnabled' => $this->configRepository->isPONumberEnabled(),
                    'isTwoLinkEnabled' => $this->configRepository->isTwoLinkEnabled(),
                    'internationalTelephoneConfig' => $internationalTelephoneConfig,
                    'companyAutoCompleteConfig' => $companyAutoCompleteConfig,
                    'intentOrderConfig' => $intentOrderConfig,
                    'isAddressAutoCompleteEnabled' => $this->configRepository->isAddressAutocompleteEnabled(),
                    'supportedCountryCodes' => ['NO', 'GB', 'SE']
                ],
            ],
        ];
    }
}

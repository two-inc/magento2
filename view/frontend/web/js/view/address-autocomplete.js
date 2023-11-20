/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
define([
    'jquery',
    'mage/translate',
    'underscore',
    'Magento_Ui/js/form/form',
    'Magento_Customer/js/customer-data',
    'Magento_Checkout/js/model/step-navigator',
    'uiRegistry'
], function ($, $t, _, Component, customerData, stepNavigator, uiRegistry) {
    'use strict';

    var config = window.checkoutConfig.payment.two_payment;

    return Component.extend({
        isCompanyNameAutoCompleteEnabled: config.isCompanyNameAutoCompleteEnabled,
        isAddressAutoCompleteEnabled: config.isAddressAutoCompleteEnabled,
        supportedCountryCodes: config.supportedCountryCodes,
        isInternationalTelephoneEnabled: config.isInternationalTelephoneEnabled,
        showTelephone: config.showTelephone,
        countrySelector: '#shipping-new-address-form select[name="country_id"]',
        companyNameSelector: '#shipping-new-address-form input[name="company"]',
        companyIdSelector: '#shipping-new-address-form input[name="custom_attributes[company_id]"]',
        telephoneSelector: '#shipping-new-address-form input[name="custom_attributes[two_telephone]"]',
        shippingTelephoneSelector: '#shipping-new-address-form input[name="telephone"]',
        enterDetailsManuallyText: $t('Enter details manually'),
        enterDetailsManuallyButton: '#shipping_enter_details_manually',
        searchForCompanyText: $t('Search for company'),
        searchForCompanyButton: '#shipping_search_for_company',
        initialize: function () {
            let self = this;
            this._super();
            $.async(this.countrySelector, function (countrySelector) {
                self.toggleCompanyVisibility();
                $(countrySelector).on('change', function () {
                    self.toggleCompanyVisibility();
                });
            });
            if (this.isCompanyNameAutoCompleteEnabled) {
                this.enableCompanyAutoComplete();
            }
            let progressBar = uiRegistry.get('index = progressBar'),
                configuredCheckoutStep = 0;
            if (progressBar !== undefined) {
                configuredCheckoutStep = _.findIndex(progressBar.steps(), {
                    code: this.showTelephone
                });
            }
            if (
                this.isInternationalTelephoneEnabled &&
                configuredCheckoutStep == stepNavigator.getActiveItemIndex()
            ) {
                this.enableInternationalTelephone();
            }
            const setTwoTelephone = (e) => customerData.set('twoTelephone', e.target.value);
            $.async(self.shippingTelephoneSelector, function (telephoneSelector) {
                $(telephoneSelector).on('change keyup', setTwoTelephone);
                const telephone = $(self.shippingTelephoneSelector).val();
                customerData.set('twoTelephone', telephone);
            });
        },
        toggleCompanyVisibility: function () {
            const countryCode = $(this.countrySelector).val().toLowerCase();
            customerData.set('twoCountryCode', countryCode);
            let field = $(this.companyNameSelector).closest('.field');
            if (countryCode in config.companyAutoCompleteConfig.searchHosts) {
                field.show();
            } else {
                field.hide();
                this.setCompanyData();
            }
        },
        setCompanyData: function (twoCompanyId = '', twoCompanyName = '') {
            console.log({ twoCompanyId, twoCompanyName });
            customerData.set('twoCompanyId', twoCompanyId);
            customerData.set('twoCompanyName', twoCompanyName);
            $('.select2-selection__rendered').text(twoCompanyName);
            $(this.companyNameSelector).val(twoCompanyName)
            $(this.companyIdSelector).val(twoCompanyId)
        },
        enableInternationalTelephone: function () {
            var self = this;
            require(['intlTelInput'], function () {
                $.async(self.telephoneSelector, function (telephoneField) {
                    $(telephoneField).intlTelInput({
                        preferredCountries: _.uniq(self.supportedCountryCodes),
                        utilsScript: config.internationalTelephoneConfig.utilsScript,
                        nationalMode: true
                    });
                });
            });
        },
        enableCompanyAutoComplete: function () {
            var self = this;
            require(['Two_Gateway/select2-4.1.0/js/select2.min'], function () {
                $.async(self.companyNameSelector, function (companyNameField) {
                    var searchLimit = config.companyAutoCompleteConfig.searchLimit;
                    $(companyNameField)
                        .select2({
                            minimumInputLength: 3,
                            width: '100%',
                            placeholder: '',
                            escapeMarkup: function (markup) {
                                return markup;
                            },
                            templateResult: function (data) {
                                return data.html;
                            },
                            templateSelection: function (data) {
                                return data.text;
                            },
                            ajax: {
                                dataType: 'json',
                                delay: 400,
                                url: function (params) {
                                    var searchHosts = config.companyAutoCompleteConfig.searchHosts,
                                        selectedCountryCode = $(self.countrySelector).val(),
                                        searchHost = '';
                                    if (selectedCountryCode.toLowerCase() in searchHosts) {
                                        searchHost = searchHosts[selectedCountryCode.toLowerCase()];
                                    }
                                    params.page = params.page || 1;
                                    return (
                                        searchHost +
                                        '/search?limit=' +
                                        searchLimit +
                                        '&offset=' +
                                        (params.page - 1) * searchLimit +
                                        '&q=' +
                                        unescape(params.term)
                                    );
                                },
                                processResults: function (response, params) {
                                    var items = [];
                                    if (response.status === 'success') {
                                        for (var i = 0; i < response.data.items.length; i++) {
                                            var item = response.data.items[i];
                                            items.push({
                                                id: item.name,
                                                text: item.name,
                                                html: `${item.highlight} (${item.id})`,
                                                companyId: item.id
                                            });
                                        }
                                    }
                                    return {
                                        results: items,
                                        pagination: {
                                            more: params.page * searchLimit < response.data.total
                                        }
                                    };
                                },
                                data: function () {
                                    return {};
                                }
                            }
                        })
                        .on('select2:open', function () {
                            if ($(self.enterDetailsManuallyButton).length == 0) {
                                $('.select2-results')
                                    .parent()
                                    .append(
                                        `<div id="shipping_enter_details_manually" class="enter_details_manually" title="${self.enterDetailsManuallyText}">` +
                                            `<span>${self.enterDetailsManuallyText}</span>` +
                                            '</div>'
                                    );
                                $(self.enterDetailsManuallyButton).on('click', function (e) {
                                    self.setCompanyData();
                                    $(self.companyNameSelector).select2('destroy');
                                    $(self.companyNameSelector).attr('type', 'text');
                                    $(self.companyNameSelector).val('');
                                    $(self.searchForCompanyButton).show();
                                });
                            }
                            document.querySelector('.select2-search__field').focus();
                        })
                        .on('select2:select', function (e) {
                            var selectedItem = e.params.data;
                            $('.select2-selection__rendered').text(selectedItem.id);
                            self.setCompanyData(selectedItem.companyId, selectedItem.text);
                            if (self.isAddressAutoCompleteEnabled) {
                                let countryId = $(self.countrySelector).val();
                                if (
                                    _.indexOf(
                                        self.supportedCountryCodes,
                                        countryId.toLowerCase()
                                    ) != -1
                                ) {
                                    const addressResponse = $.ajax({
                                        dataType: 'json',
                                        url:
                                            config.intentOrderConfig.host +
                                            '/v1/' +
                                            countryId.toUpperCase() +
                                            '/company/' +
                                            selectedItem.companyId +
                                            '/address'
                                    });
                                    addressResponse.done(function (response) {
                                        if (response.address) {
                                            $('input[name="city"]').val(response.address.city);
                                            $('input[name="postcode"]').val(
                                                response.address.postalCode
                                            );
                                            $('input[name="street[0]"]').val(
                                                response.address.streetAddress
                                            );
                                            $(
                                                'input[name="city"], input[name="postcode"], input[name="street[0]"]'
                                            ).trigger('change');
                                        }
                                    });
                                }
                            }
                        });
                    if ($(self.companyNameSelector).val()) {
                        // pre-fill on checkout render
                        $('.select2-selection__rendered').text($(self.companyNameSelector).val());
                    }
                    if ($(self.searchForCompanyButton).length == 0) {
                        $(self.companyNameSelector)
                            .closest('.field')
                            .append(
                                `<div id="shipping_search_for_company" class="search_for_company" title="${self.searchForCompanyText}">` +
                                    `<span>${self.searchForCompanyText}</span>` +
                                    '</div>'
                            );
                        $(self.searchForCompanyButton).on('click', function (e) {
                            self.enableCompanyAutoComplete();
                            $(self.searchForCompanyButton).hide();
                        });
                    }
                    $(self.searchForCompanyButton).hide();
                });
            });
        }
    });
});

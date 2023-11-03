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
    ],
    function ($, $t, _, Component, customerData, stepNavigator, uiRegistry) {
        "use strict";

        var config = window.checkoutConfig.payment.two_payment;

        return Component.extend({
            isCompanyNameAutoCompleteEnabled: config.isCompanyNameAutoCompleteEnabled,
            isAddressAutoCompleteEnabled: config.isAddressAutoCompleteEnabled,
            supportedCountryCodes: config.supportedCountryCodes,
            isInternationalTelephoneEnabled: config.isInternationalTelephoneEnabled,
            showTelephone: config.showTelephone,
            countrySelector: '#shipping-new-address-form select[name="country_id"]',
            companySelector: '#shipping-new-address-form input[name="company"]',
            telephoneSelector: 'input[name="custom_attributes[two_telephone]"]',
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
                    configuredCheckoutStep = _.findIndex(progressBar.steps(), {code: this.showTelephone});
                }
                if (this.isInternationalTelephoneEnabled
                    && configuredCheckoutStep == stepNavigator.getActiveItemIndex()) {
                    this.enableInternationalTelephone();
                }
                const setTwoTelephone = (e) => customerData.set('twoTelephone', e.target.value);
                $.async(self.shippingTelephoneSelector, function (telephoneSelector) {
                    $(telephoneSelector).on('change keyup', setTwoTelephone);
                });
            },
            toggleCompanyVisibility: function () {
                const countryCode = $(this.countrySelector).val().toLowerCase();
                customerData.set('twoCountryCode', countryCode);
                let field = $(this.companySelector).closest('.field');
                if (countryCode in config.companyAutoCompleteConfig.searchHosts) {
                    field.show();
                } else {
                    field.hide();
                    this.setCompanyData();
                    $('.select2-selection__rendered').text('');
                    $(this.companySelector).val('');
                }
            },
            setCompanyData: function (twoCompanyId = '', twoCompanyName = '') {
                customerData.set('twoCompanyId', twoCompanyId);
                customerData.set('twoCompanyName', twoCompanyName);
            },
            enableInternationalTelephone: function () {
                var self = this;
                require([
                    'intlTelInput'
                ], function () {
                    $.async(self.telephoneSelector, function (telephoneField) {
                        $(telephoneField).intlTelInput({
                            preferredCountries: _.uniq(self.supportedCountryCodes),
                            utilsScript: config.internationalTelephoneConfig.utilsScript,
                            hiddenInput: "full",
                            separateDialCode: true
                        });
                    });
                });
            },
            enableCompanyAutoComplete: function () {
                var self = this;
                require([
                    'Two_Gateway/js/select2.min'
                ], function () {
                    $.async(self.companySelector, function (companyNameField) {
                        var searchLimit = config.companyAutoCompleteConfig.searchLimit;
                        $(companyNameField).select2({
                            minimumInputLength: 3,
                            width: '100%',
                            placeholder: '',
                            escapeMarkup: function (markup) {
                                return markup;
                            },
                            templateResult: function (data) {
                                return data.id;
                            },
                            templateSelection: function (data) {
                                return data.id;
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
                                    return searchHost + '/search?limit='
                                        + searchLimit
                                        + '&offset=' + ((params.page - 1) * searchLimit) + '&q=' + unescape(params.term)
                                },
                                processResults: function (response, params) {
                                    var items = [];
                                    if (response.status === 'success') {
                                        for (var i = 0; i < response.data.items.length; i++) {
                                            var item = response.data.items[i]
                                            items.push({
                                                id: item.name + ' (' + item.id + ')',
                                                companyId: item.id,
                                                companyName: item.name,
                                                approved: false
                                            });
                                        }
                                    }
                                    return {
                                        results: items,
                                        pagination: {
                                            more: (params.page * searchLimit) < response.data.total
                                        }
                                    }
                                },
                                data: function () {
                                    return {}
                                }
                            }
                        }).on('select2:open', function () {
                            if ($(self.enterDetailsManuallyButton).length == 0) {
                                $('.select2-results').parent().append(
                                    `<div id="shipping_enter_details_manually" class="enter_details_manually" title="${self.enterDetailsManuallyText}">` +
                                    `<span>${self.enterDetailsManuallyText}</span>` +
                                    '</div>'
                                );
                                $(self.enterDetailsManuallyButton).on('click', function(e) {
                                    self.setCompanyData();
                                    $(self.companySelector).select2('destroy');
                                    $(self.companySelector).attr('type', 'text');
                                    $(self.searchForCompanyButton).show();
                                });
                            }
                            document.querySelector('.select2-search__field').focus();
                        }).on('select2:select', function (e) {
                            var selectedItem = e.params.data;
                            $('.select2-selection__rendered').html(selectedItem.id);
                            self.setCompanyData(selectedItem.companyId, selectedItem.companyName);
                            if (self.isAddressAutoCompleteEnabled) {
                                let countryId = $(self.countrySelector).val();
                                if (_.indexOf(self.supportedCountryCodes, countryId.toLowerCase()) != -1) {
                                    const addressResponse = $.ajax({
                                        dataType: 'json',
                                        url: config.intentOrderConfig.host + '/v1/' + countryId.toUpperCase()
                                            + '/company/' + selectedItem.companyId + '/address'
                                    });
                                    addressResponse.done(function (response) {
                                        if (response.address) {
                                            $('input[name="city"]').val(response.address.city);
                                            $('input[name="postcode"]').val(response.address.postalCode);
                                            $('input[name="street[0]"]').val(response.address.streetAddress);
                                            $('input[name="city"], input[name="postcode"], input[name="street[0]"]')
                                                .trigger('change');
                                        }
                                    });
                                }
                            }
                        });
                        if ($(self.companySelector).val()) {
                            // pre-fill on checkout render
                            $('.select2-selection__rendered').text($(self.companySelector).val());
                        }
                        if ($(self.searchForCompanyButton).length == 0) {
                            $(self.companySelector).closest('.field').append(
                                `<div id="shipping_search_for_company" class="search_for_company" title="${self.searchForCompanyText}">` +
                                `<span>${self.searchForCompanyText}</span>` +
                                '</div>'
                            );
                            $(self.searchForCompanyButton).on('click', function(e) {
                                self.enableCompanyAutoComplete();
                                $(self.searchForCompanyButton).hide();
                            });
                        }
                        $(self.searchForCompanyButton).hide();
                    });
                });
            },
        })
    });

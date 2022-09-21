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
            supportedCoutryCodes: config.supportedCoutryCodes,
            isInternationalTelephoneEnabled: config.isInternationalTelephoneEnabled,
            showTelephone: config.showTelephone,
            countrySelector: '#shipping-new-address-form select[name="country_id"]',
            companySelector: '#shipping-new-address-form input[name="company"]',
            telephoneSelector: 'input[name="custom_attributes[two_telephone]"]',
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
            },
            toggleCompanyVisibility: function () {
                let field = $(this.companySelector).closest('.field');
                if ($(this.countrySelector).val().toLowerCase() in config.companyAutoCompleteConfig.searchHosts) {
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
                            preferredCountries: _.uniq(self.supportedCoutryCodes),
                            utilsScript: config.internationalTelephoneConfig.utilsScript
                        });
                    });
                });
            },
            enableCompanyAutoComplete: function () {
                var self = this,
                    buttonTitle = $t('I can not find my company');
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
                            document.querySelector('.select2-search__field').focus();
                        }).on('select2:select', function (e) {
                            var selectedItem = e.params.data;
                            $('.select2-selection__rendered').html(selectedItem.id);
                            self.setCompanyData(selectedItem.companyId, selectedItem.companyName);
                            if (self.isAddressAutoCompleteEnabled) {
                                let countryId = $(self.countrySelector).val();
                                if (_.indexOf(self.supportedCoutryCodes, countryId.toUpperCase()) != -1) {
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
                        $(self.companySelector).closest('.field').append(
                            '<div class="company-search-additional">' +
                            '<button id="clear_company_name" title="' + buttonTitle + '">' +
                            '<span>' + buttonTitle + '</span>' +
                            '</button>' +
                            '</div>'
                        );
                        $('#clear_company_name').on('click', function (e) {
                            e.preventDefault();
                            $(self.companySelector).select2('destroy');
                            $(self.companySelector).attr('type', 'text');
                            $(this).remove();
                        });
                    });
                });
            },
        })
    });

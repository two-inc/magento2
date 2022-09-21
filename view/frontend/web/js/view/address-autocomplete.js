/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
define([
        'jquery',
        'mage/translate',
        'underscore',
        'Magento_Ui/js/form/form',
        'Magento_Customer/js/customer-data'
    ],
    function($, $t, _, Component, customerData){
    "use strict";

    var config = window.checkoutConfig.payment.two_payment;

    return Component.extend({
        isCompanyNameAutoCompleteEnabled: config.isCompanyNameAutoCompleteEnabled,
        isAddressAutoCompleteEnabled: config.isAddressAutoCompleteEnabled,
        countrySelector: '#shipping-new-address-form select[name="country_id"]',
        companySelector: '#shipping-new-address-form input[name="company"]',
        initialize: function () {
            let self = this;

            this._super();

            $.async(this.countrySelector, function (countrySelector){
                self.toggleCompanyVisibility();
                $(countrySelector).on('change', function (){
                    self.toggleCompanyVisibility();
                });
            });

            if (this.isCompanyNameAutoCompleteEnabled) {
                this.enableCompanyAutoComplete();
            }
        },

        setCompanyData: function (twoCompanyId = '', twoCompanyName = '') {
            customerData.set('twoCompanyId', twoCompanyId);
            customerData.set('twoCompanyName', twoCompanyName);
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

        enableCompanyAutoComplete: function () {
            let self = this,
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
                                let searchHosts = config.companyAutoCompleteConfig.searchHosts,
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
                    }).on('select2:open', function (){
                        document.querySelector('.select2-search__field').focus();
                    }).on('select2:select', function (e) {
                        var selectedItem = e.params.data;
                        $('.select2-selection__rendered').html(selectedItem.id);
                        self.setCompanyData(selectedItem.companyId, selectedItem.companyName);
                        if (self.isAddressAutoCompleteEnabled) {
                            let countryId = $(self.countrySelector).val();
                            if (_.indexOf(['NO', 'GB', 'SE'], countryId) != -1) {
                                const addressResponse = $.ajax({
                                    dataType: 'json',
                                    url: config.intentOrderConfig.host + '/v1/' + countryId + '/company/' + selectedItem.companyId + '/address'
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

                    // pre-fill on checkout render
                    if ($(self.companySelector).val()) {
                        $('.select2-selection__rendered').text($(self.companySelector).val());
                    }

                    $(self.companySelector).closest('.field').append(
                        '<div class="company-search-additional">' +
                            '<button id="clear_company_name" title="' + buttonTitle + '">' +
                                '<span>' + buttonTitle + '</span>' +
                            '</button>' +
                        '</div>'
                    );
                    $('#clear_company_name').on('click', function (e){
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

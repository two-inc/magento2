/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
define([
        'jquery',
        'underscore',
        'Magento_Ui/js/form/form'
    ],
    function($, _, Component){
    "use strict";

    var config = window.checkoutConfig.payment.two_payment;

    return Component.extend({
        isCompanyNameAutoCompleteEnabled: false, //temporary disable it for version 1.0
        isAddressAutoCompleteEnabled: config.isAddressAutoCompleteEnabled,
        companyNameSelector: 'input[name="company"]',
        initialize: function () {
            this._super();
            if (this.isCompanyNameAutoCompleteEnabled) {
                this.enableCompanyAutoComplete();
            }
        },

        enableCompanyAutoComplete: function () {
            var self = this;
            require([
                'Two_Gateway/js/select2.min'
            ], function () {
                $.async(self.companyNameSelector, function (companyNameField) {
                    var searchLimit = config.companyAutoCompleteConfig.searchLimit;
                    $(companyNameField).select2({
                        minimumInputLength: 3,
                        width: '100%',
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
                                    searchHost = searchHosts['default'];

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
                                            id: item.name,
                                            text: item.name,
                                            html: item.highlight + ' (' + item.id + ')',
                                            companyId: item.id,
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
                    }).on('select2:select', function (e) {
                        var selectedItem = e.params.data;
                        $('.select2-selection--single').html(selectedItem.text);
                        if (self.isAddressAutoCompleteEnabled) {
                            let cointry_id = $('select[name="country_id"]').val();
                            if (( cointry_id == 'NO')
                                || (cointry_id == 'GB')
                            ) {
                                const addressResponse = $.ajax({
                                    dataType: 'json',
                                    url: config.intentOrderConfig.host + '/v1/' + cointry_id + '/company/' + selectedItem.companyId + '/address'
                                });
                                addressResponse.done(function (response) {
                                    if (response.address) {
                                        $('input[name="city"]').val(response.address.city);
                                        $('input[name="postcode"]').val(response.address.postalCode);
                                        $('input[name="street[0]"]').val(response.address.streetAddress);
                                    }
                                });
                            }
                        }
                    });
                });
            });
        },
    })
});

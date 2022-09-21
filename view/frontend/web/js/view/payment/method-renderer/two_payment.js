/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
define([
        'ko',
        'jquery',
        'underscore',
        'Magento_Checkout/js/view/payment/default',
        'Magento_Checkout/js/model/quote',
        'Magento_Customer/js/customer-data',
        'Magento_Checkout/js/model/payment/additional-validators',
        'mage/translate',
        'Magento_Checkout/js/model/full-screen-loader',
        'Magento_Checkout/js/action/redirect-on-success',
        'Magento_Ui/js/lib/view/utils/async',
        'mage/validation',
        'jquery/jquery-storageapi'
    ],
    function (ko, $, _, Component, quote, customerData, additionalValidators, $t, fullScreenLoader, redirectOnSuccessAction) {
        'use strict';

        var config = window.checkoutConfig.payment.two_payment,
            telephone = '',
            customAttributesObject = {};

        if (quote.shippingAddress() && quote.shippingAddress().telephone) {
            telephone = quote.shippingAddress().telephone.replace(' ', '');
        }

        if ($.isArray(quote.billingAddress().customAttributes)) {
            quote.billingAddress().customAttributes.forEach(function (value) {
                customAttributesObject[value.attribute_code] = value.value;
            });
        }

        return Component.extend({
            defaults: {
                template: 'Two_Gateway/payment/two_payment'
            },
            redirectAfterPlaceOrder: false,
            isOrderIntentEnabled: false,
            isCompanyNameAutoCompleteEnabled: config.isCompanyNameAutoCompleteEnabled,
            isInternationalTelephoneEnabled: config.isInternationalTelephoneEnabled,
            isDepartmentFieldEnabled: config.isDepartmentFieldEnabled,
            // showTelephone: config.showTelephone,
            isProjectFieldEnabled: config.isProjectFieldEnabled,
            isOrderNoteFieldEnabled: config.isOrderNoteFieldEnabled,
            isPONumberFieldEnabled: config.isPONumberFieldEnabled,
            isTwoLinkEnabled: config.isTwoLinkEnabled,
            companyName: customerData.get('twoCompanyName'),
            companyId: customerData.get('twoCompanyId'),
            project: ko.observable(customAttributesObject.project),
            department: ko.observable(customAttributesObject.department),
            orderNote: ko.observable(''),
            poNumber: ko.observable(''),
            telephone: ko.observable(telephone),
            formSelector: 'form#two_gateway_form',
            telephoneSelector: 'input#two_telephone',
            companyNameSelector: 'input#two_company_name',
            generalErrorMessage: $t('Something went wrong with your request. Please check your data and try again.'),
            initialize: function () {
                this._super();
                if (this.isInternationalTelephoneEnabled) {
                    this.enableInternationalTelephone();
                }

                if (this.isCompanyNameAutoCompleteEnabled) {
                    this.enableCompanyAutoComplete();
                }

                this.configureFormValidation();
            },
            afterPlaceOrder: function () {
                var url = $.mage.cookies.get(config.redirectUrlCookieCode);
                if (url) {
                    $.mage.redirect(url);
                }
            },
            placeOrder: function (data, event) {
                var self = this;
                if (event) {
                    event.preventDefault();
                }

                if (self.validate() &&
                    additionalValidators.validate() &&
                    self.isPlaceOrderActionAllowed() === true
                ) {
                    if (this.isOrderIntentEnabled) {
                        fullScreenLoader.startLoader();
                        this.placeIntentOrder().always(function () {
                            fullScreenLoader.stopLoader();
                        }).done(function (response) {
                            self.processIntentSuccessResponse(response);
                        }).error(function (response) {
                            self.processIntentErrorResponse(response);
                        });
                    } else {
                        self.placeOrderBackend();
                    }
                }
            },
            showTelephoneOnBillingPage: function() {
                // return (this.showTelephone === 'billing');
                return false;
            },
            placeOrderBackend: function () {
                var self = this;
                this.isPlaceOrderActionAllowed(false);
                return this.getPlaceOrderDeferredObject().done(function () {
                    self.afterPlaceOrder();
                    if (self.redirectAfterPlaceOrder) {
                        redirectOnSuccessAction.execute();
                    }
                }).always(function () {
                    self.isPlaceOrderActionAllowed(true);
                });
            },
            processIntentSuccessResponse: function (response) {
                if (response) {
                    if (response.approved) {
                        this.placeOrderBackend();
                    } else {
                        this.messageContainer.addErrorMessage({
                            message: this.getDeclinedErrorMessage(response.decline_reason)
                        });
                    }
                } else {
                    this.messageContainer.addErrorMessage({
                        message: this.generalErrorMessage
                    });
                }
            },
            getDeclinedErrorMessage: function (declineReason) {
                var message = $t('Your order has been declined.'),
                    reason = '';
                switch (declineReason) {
                    case 'TOO_HIGH_RISK':
                        reason = $t('Risk too high.');
                        break;
                    case 'BUYER_LIMIT_EXCEEDED':
                        reason = $t('Buyer limit exceeded.');
                        break;
                    case 'BUYER_NOT_FOUND':
                        reason = $t('Buyer not found.');
                        break;
                    case 'BUYER_ADDRESS_DEVIATION':
                        reason = $t('Buyer address is invalid.');
                        break;
                    case 'BUYER_INFO_INCONSISTENT':
                        reason = $t('Buyer info in inconsistent.');
                        break;
                    case 'BUYER_AUTHENTICATION_FAILED':
                        reason = $t('Buyer authentication failed.');
                        break;
                }

                if (reason) {
                    message += ' ' + $t('Reason') + ': ' + reason;
                }

                return message;
            },
            processIntentErrorResponse: function (response) {
                var message = this.generalErrorMessage,
                    self = this;
                if (response && response.responseJSON) {
                    var errorCode = response.responseJSON.error_code,
                        errorMessage = response.responseJSON.error_message,
                        errorDetails = response.responseJSON.error_details;
                    switch (errorCode) {
                        case 'SCHEMA_ERROR':
                            var errors = response.responseJSON.error_json;
                            if (errors) {
                                message = '';
                                self.messageContainer.clear();
                                _.each(errors, function (error) {
                                    self.messageContainer.errorMessages.push(error.msg);
                                });
                            }

                            break;
                        case 'JSON_MISSING_FIELD':
                            if (errorDetails) {
                                message = errorDetails;
                            }

                            break;
                        case 'MERCHANT_NOT_FOUND_ERROR':
                        case 'ORDER_INVALID':
                            message = errorMessage;
                            if (errorDetails) {
                                message += ' - ' + errorDetails;
                            }

                            break;
                    }
                }

                if (message) {
                    self.messageContainer.addErrorMessage({
                        message: message
                    });
                }
            },
            placeIntentOrder: function () {
                var totals = quote.getTotals()(),
                    billingAddress = quote.billingAddress(),
                    lineItems = [];

                _.each(quote.getItems(), function (item) {
                    lineItems.push({
                        'name': item['name'],
                        'description': item['description'] ? item['description'] : '',
                        'discount_amount': parseFloat(item['discount_amount']).toFixed(2),
                        'gross_amount': parseFloat(item['row_total_incl_tax']).toFixed(2),
                        'net_amount': parseFloat(item['row_total']).toFixed(2),
                        'quantity': item['qty'],
                        'unit_price': parseFloat(item['price']).toFixed(2),
                        'tax_amount': parseFloat(item['tax_amount']).toFixed(2),
                        'tax_rate': parseFloat(item['tax_percent']).toFixed(6),
                        'tax_class_name': '',
                        'quantity_unit': config.intentOrderConfig.weightUnit,
                        'image_url': item['thumbnail'],
                        'type': item['is_virtual'] === "0" ? 'PHYSICAL' : 'DIGITAL'
                    });
                });

                return $.ajax({
                    url: config.intentOrderConfig.host
                        + '/v1/order_intent?'
                        + 'client=' + config.intentOrderConfig.extensionPlatformName
                        + '&client_v=' + config.intentOrderConfig.extensionDBVersion,
                    type: 'POST',
                    global: true,
                    contentType: 'application/json',
                    headers: {},
                    data: JSON.stringify({
                        'gross_amount': parseFloat(totals['grand_total']).toFixed(2),
                        'invoice_type': config.intentOrderConfig.invoiceType,
                        'currency': totals['base_currency_code'],
                        'line_items': lineItems,
                        'buyer': {
                            'company': {
                                'organization_number': this.companyId(),
                                'country_prefix': billingAddress.countryId,
                                'company_name': this.companyName(),
                                'website': window.BASE_URL
                            },
                            'representative': {
                                'email': quote.guestEmail ? quote.guestEmail : window.checkoutConfig.customerData.email,
                                'first_name': billingAddress.firstname,
                                'last_name': billingAddress.lastname,
                                'phone_number': this.telephone()
                            }
                        },
                        'merchant_short_name': config.intentOrderConfig.merchantShortName
                    })
                });
            },
            validate: function () {
                return $(this.formSelector).valid();
            },
            getCode: function () {
                return 'two_payment';
            },
            getData: function () {
                return {
                    'method': this.getCode(),
                    'additional_data': {
                        companyName: this.companyName(),
                        companyId: this.companyId(),
                        project: this.project(),
                        department: this.department(),
                        orderNote: this.orderNote(),
                        poNumber: this.poNumber(),
                        telephone: this.telephone()
                    }
                };
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
                                        billingAddress = quote.billingAddress(),
                                        searchHost = searchHosts['default'];
                                    if (billingAddress && billingAddress.countryId && searchHosts[billingAddress.countryId.toLowerCase()]) {
                                        searchHost = searchHosts[billingAddress.countryId.toLowerCase()];
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
                            $('#select2-two_company_name-container').html(selectedItem.text);
                            self.companyName(selectedItem.text);
                            self.companyId(selectedItem.companyId);
                            $('#two_company_id').prop('disabled', true);
                        });

                        $('.select2-selection__rendered').text(self.companyName());
                    });
                });
            },
            enableInternationalTelephone: function () {
                var self = this;
                require([
                    'intlTelInput'
                ], function () {
                    $.async(self.telephoneSelector, function (telephoneField) {
                        var preferredCountries = [],
                            billingAddress = quote.billingAddress();
                        if (billingAddress) {
                            preferredCountries.push(billingAddress.countryId.toLowerCase());
                        }

                        preferredCountries.push('gb');
                        preferredCountries.push('no');

                        $(telephoneField).intlTelInput({
                            nationalMode: false,
                            preferredCountries: _.uniq(preferredCountries),
                            utilsScript: config.internationalTelephoneConfig.utilsScript
                        });
                    });
                });
            },
            configureFormValidation: function () {
                $.async(this.formSelector, function (form) {
                    $(form).validation({
                        errorPlacement: function (error, element) {
                            var errorPlacement = element.closest('.field');
                            if (element.is(':checkbox') || element.is(':radio')) {
                                errorPlacement = element.parents('.control').children().last();
                                if (!errorPlacement.length) {
                                    errorPlacement = element.siblings('label').last();
                                }
                            }

                            if (element.siblings('.tooltip').length) {
                                errorPlacement = element.siblings('.tooltip');
                            }

                            if (element.next().find('.tooltip').length) {
                                errorPlacement = element.next();
                            }

                            errorPlacement.append(error);
                        }
                    });
                });
            },
            clearCompany: function () {
                jQuery('#two_company_id').val('')
                jQuery('span.select2').remove();
                jQuery('#two_company_name').removeClass('select2-hidden-accessible').val('');
            }
        });
    }
);

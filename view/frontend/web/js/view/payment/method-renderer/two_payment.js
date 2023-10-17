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
        'Magento_Checkout/js/model/step-navigator',
        'uiRegistry',
        'Magento_Checkout/js/model/payment/additional-validators',
        'mage/translate',
        'Magento_Checkout/js/model/full-screen-loader',
        'Magento_Checkout/js/action/redirect-on-success',
        'mage/url',
        'Magento_Ui/js/lib/view/utils/async',
        'mage/validation',
        'jquery/jquery-storageapi'
    ],
    function (
        ko,
        $,
        _,
        Component,
        quote,
        customerData,
        stepNavigator,
        uiRegistry,
        additionalValidators,
        $t, fullScreenLoader,
        redirectOnSuccessAction,
        url
    ) {
        'use strict';

        let config = window.checkoutConfig.payment.two_payment,
            telephone = '',
            customAttributesObject = {},
            shippingTwoTelephoneAttribute = {};
        if (quote.shippingAddress()) {
            if (quote.shippingAddress().telephone !== undefined) {
                telephone = quote.shippingAddress().telephone.replace(' ', '');
            }
            if ($.isArray(quote.shippingAddress().customAttributes)) {
                shippingTwoTelephoneAttribute = _.findWhere(
                    quote.shippingAddress().customAttributes,
                    {attribute_code: "two_telephone"}
                );
                telephone = (shippingTwoTelephoneAttribute) ? shippingTwoTelephoneAttribute.value : telephone;
            }
        }
        if (quote.billingAddress() && $.isArray(quote.billingAddress().customAttributes)) {
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
            showTelephone: config.showTelephone,
            isProjectFieldEnabled: config.isProjectFieldEnabled,
            isOrderNoteFieldEnabled: config.isOrderNoteFieldEnabled,
            isPONumberFieldEnabled: config.isPONumberFieldEnabled,
            isTwoLinkEnabled: config.isTwoLinkEnabled,
            supportedCountryCodes: config.supportedCountryCodes,
            companyName: ko.observable(''),
            companyId: ko.observable(''),
            project: ko.observable(customAttributesObject.project),
            department: ko.observable(customAttributesObject.department),
            orderNote: ko.observable(''),
            poNumber: ko.observable(''),
            telephone: ko.observable(telephone),
            formSelector: 'form#two_gateway_form',
            telephoneSelector: 'input#two_telephone',
            fullTelephoneSelector: 'input#two_telephone_full',
            companyNameSelector: 'input#two_company_name',
            generalErrorMessage: $t('Something went wrong with your request. Please check your data and try again.'),
            token: {
                delegation: '',
                autofill: '',
            },
            showErrorMessage: ko.observable(false),
            showPopupMessage: ko.observable(false),
            showSoleTrader: ko.observable(false),

            initialize: function () {
                this._super();
                if (this.showTwoTelephone()) {
                    this.enableInternationalTelephone();
                }
                this.limitedCompanyMode();
                this.configureFormValidation();
                this.getTokens();
                this.addVerifyEvent();
            },
            fillCustomerData: function() {
                const companyName = customerData.get('twoCompanyName')()
                this.companyName(typeof companyName == 'string' ? companyName : '');

                const companyId = customerData.get('twoCompanyId')()
                this.companyId(typeof companyId == 'string' ? companyId : '');
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
            showTwoTelephone: function () {
                let progressBar = uiRegistry.get('index = progressBar'),
                    configuredCheckoutStep = _.findIndex(progressBar.steps(), {code: this.showTelephone}),
                    currentCheckoutStep = stepNavigator.getActiveItemIndex();
                return (this.isInternationalTelephoneEnabled && configuredCheckoutStep == currentCheckoutStep);
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
                let totals = quote.getTotals()(),
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
                        telephone: $(this.fullTelephoneSelector).val() // checkout-data -> shippingAddressFromData -> custom_attributes -> two_telephone_full
                    }
                };
            },
            enableCompanyAutoComplete: function () {
                let self = this;
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
                                    if (billingAddress && billingAddress.countryId
                                        && searchHosts[billingAddress.countryId.toLowerCase()]) {
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
                let self = this;
                require([
                    'intlTelInput'
                ], function () {
                    $.async(self.telephoneSelector, function (telephoneField) {
                        let preferredCountries = self.supportedCountryCodes,
                            billingAddress = quote.billingAddress(),
                            defaultCountry = billingAddress
                                ? billingAddress.countryId.toLowerCase()
                                : quote.shippingAddress().countryId.toLowerCase();
                        preferredCountries.push(defaultCountry);
                        $(telephoneField).intlTelInput({
                            preferredCountries: _.uniq(preferredCountries),
                            utilsScript: config.internationalTelephoneConfig.utilsScript,
                            initialCountry: defaultCountry,
                            separateDialCode: true
                        });
                        $(telephoneField).on('keyup', function () {
                            self.removeTelephoneLeadingZero();
                        });
                        self.removeTelephoneLeadingZero();
                        $(telephoneField).on('change countrychange', function () {
                            self.setFullTelephone();
                        });
                        self.setFullTelephone();
                    });
                });
            },
            removeTelephoneLeadingZero: function () {
                let telephone = $(this.telephoneSelector).val();
                telephone = telephone.replace(/^0+/, '');
                $(this.telephoneSelector).val(telephone);
            },
            setFullTelephone: function () {
                /**
                 * Note 1! Origin method "getInstance" doesn't work as described in:
                 *         https://github.com/jackocnr/intl-tel-input#static-methods
                 * Note 2! "iti" will be initialized correctly when only 1 telephone is initialized at the web page
                 * Note 3! this logic can't be replaced with "iti.hiddenInput" because it doesn't work as expected
                 */
                let iti = window.intlTelInputGlobals.instances[0],
                    countryCode = iti.getSelectedCountryData().dialCode,
                    telephoneNumber = $(this.telephoneSelector).val();
                $(this.fullTelephoneSelector).val('+' + countryCode + telephoneNumber);
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
                jQuery('#two_company_id').prop('disabled', false);
                jQuery('span.select2').remove();
                jQuery('#two_company_name').removeClass('select2-hidden-accessible').val('');
            },

            getTokens() {
                const URL = url.build('rest/V1/two/get-tokens');
                const OPTIONS = {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ cartId: quote.getQuoteId() }),
                };

                fetch(URL, OPTIONS)
                .then((response) => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        throw new Error(`Error response from ${URL}.`);
                    }
                })
                .then((json) => {
                    this.token.delegation = json[0].delegation_token;
                    this.token.autofill = json[0].autofill_token;
                })
                .catch(() => { console.error(new Error("Something went wrong. There's no way to get the tokens.")); });
            },

            openIframe() {
                const URL = config.popup_url + `/soletrader/signup?businessToken=${this.token.delegation}&autofillToken=${this.token.autofill}`;
                const windowFeatures = 'location=yes,resizable=yes,scrollbars=yes,status=yes, height=805, width=610';
                window.open(URL, '_blank', windowFeatures);
            },

            limitedCompanyMode() {
                if (this.isCompanyNameAutoCompleteEnabled) {
                    this.enableCompanyAutoComplete();
                }
                this.fillCustomerData();
                this.showSoleTrader(false);
            },

            soleTraderMode() {
                this.clearCompany();
                this.getCurrentBuyer();
                this.showSoleTrader(true);
            },

            getCurrentBuyer() {
                const URL = config.api_url + '/autofill/v1/buyer/current';
                const OPTIONS = {
                    credentials: "include",
                    headers: {
                        "two-delegated-authority-token": this.token.autofill,
                    },
                };

                fetch(URL, OPTIONS)
                .then((response) => {
                    if (response.ok) {
                        return response.json();
                    } else if (response.status == 404) {
                        this.showPopupMessage(true);
                        return null;
                    } else {
                        throw new Error(`Error response from ${URL}.`);
                    }
                })
                .then((json) => {
                    if (json) {
                        $('#select2-two_company_name-container').html(json.company_name);
                        this.companyName(json.company_name);
                        this.companyId(json.organization_number);
                        $('#two_company_id').prop('disabled', true);
                    }
                })
                .catch(() => {
                    this.showErrorMessage(true);
                    setTimeout(() => this.showErrorMessage(false), 3000);
                });
            },

            addVerifyEvent() {
                window.addEventListener("message", (event) => {
                    if (event.data === 'ACCEPTED') {
                        this.getCurrentBuyer();
                    } else {
                        this.showErrorMessage(true);
                        setTimeout(() => this.showErrorMessage(false), 3000);
                    }
                });
            }
        });
    }
);

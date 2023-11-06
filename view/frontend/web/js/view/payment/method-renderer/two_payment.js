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
            countryCode: ko.observable(''),
            iti: null,
            formSelector: 'form#two_gateway_form',
            telephoneSelector: 'input#two_telephone',
            companyNameSelector: 'input#two_company_name',
            companyIdSelector: 'input#two_company_id',
            generalErrorMessage: $t('Something went wrong with your request. Please check your data and try again.'),
            enterDetailsManuallyText: $t('Enter details manually'),
            enterDetailsManuallyButton: '#billing_enter_details_manually',
            searchForCompanyText: $t('Search for company'),
            searchForCompanyButton: '#billing_search_for_company',
            token: {
                delegation: '',
                autofill: '',
            },
            showSoleTraderErrorMessage: ko.observable(false),
            showPopupMessage: ko.observable(false),
            showSoleTrader: ko.observable(false),
            showWhatIsTwo: ko.observable(false),

            initialize: function () {
                this._super();
                if (this.isInternationalTelephoneEnabled) {
                    this.enableInternationalTelephone();
                }
                this.registeredOrganisationMode();
                this.configureFormValidation();
                this.addVerifyEvent();
            },
            fillCustomerData: function() {
                const fillCompanyName = (companyName) => {
                    const billingAddress = quote.billingAddress(),
                        fallbackCompanyName = typeof billingAddress.company == 'string' ? billingAddress.company : '';
                    companyName = typeof companyName == 'string' && companyName ? companyName : fallbackCompanyName;
                    this.companyName(companyName);
                    $(this.companyNameSelector).val(companyName);
                }
                customerData.get('twoCompanyName').subscribe(fillCompanyName);
                fillCompanyName(customerData.get('twoCompanyName')())

                const fillCompanyId = (companyId) => {
                    companyId = typeof companyId == 'string' ? companyId : ''
                    this.companyId(companyId);
                    $(this.companyIdSelector).val(companyId);
                }
                customerData.get('twoCompanyId').subscribe(fillCompanyId);
                fillCompanyId(customerData.get('twoCompanyId')());

                const fillTelephone = (telephone) => {
                    telephone = typeof telephone == 'string' ? telephone : ''
                    $(this.telephoneSelector).val(telephone);
                    $(this.telephoneSelector).trigger('change');
                }
                customerData.get('twoTelephone').subscribe(fillTelephone);
                fillTelephone(customerData.get('twoTelephone')());

                const fillCountryCode = (countryCode) => {
                    countryCode = typeof countryCode == 'string' ? countryCode : ''
                    this.countryCode(countryCode);
                }
                customerData.get('twoCountryCode').subscribe(fillCountryCode);
                fillCountryCode(customerData.get('twoCountryCode')());
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
            ShowTelephoneOnPaymentPage: function () {
                return this.showTelephone == 'payment';
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
                var message = $t('Your invoice purchase with Two has been declined.'),
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
                        reason = $t('Buyer info is inconsistent.');
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
            getEmail: function () {
                return quote.guestEmail ? quote.guestEmail : window.checkoutConfig.customerData.email;
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
                                'email': this.getEmail(),
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
                        telephone: this.telephone() // checkout-data -> shippingAddressFromData -> custom_attributes -> two_telephone_full
                    }
                };
            },
            enableCompanyAutoComplete: function () {
                let self = this;
                require([
                    'Two_Gateway/select2-4.0.13/js/select2.min'
                ], function () {
                    $.async(self.companyIdSelector, function (companyIdField) {
                        $(companyIdField).prop('disabled', true);
                    })
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
                        }).on('select2:open', function () {
                            if ($(self.enterDetailsManuallyButton).length == 0) {
                                $('.select2-results').parent().append(
                                    `<div id="billing_enter_details_manually" class="enter_details_manually" title="${self.enterDetailsManuallyText}">` +
                                    `<span>${self.enterDetailsManuallyText}</span>` +
                                    '</div>'
                                );
                                $(self.enterDetailsManuallyButton).on('click', function(e) {
                                    self.clearCompany();
                                    $(self.searchForCompanyButton).show();
                                });
                            }
                            document.querySelector('.select2-search__field').focus();
                        }).on('select2:select', function (e) {
                            var selectedItem = e.params.data;
                            $('#select2-two_company_name-container').html(selectedItem.text);
                            self.companyName(selectedItem.text);
                            self.companyId(selectedItem.companyId);
                            $(self.companyIdSelector).prop('disabled', true);
                        });
                        $('.select2-selection__rendered').text(self.companyName());
                        if ($(self.searchForCompanyButton).length == 0) {
                            $(self.companyNameSelector).closest('.field').append(
                                `<div id="billing_search_for_company" class="search_for_company" title="${self.searchForCompanyText}">` +
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
            enableInternationalTelephone: function () {
                let self = this;
                require([
                    'intlTelInput'
                ], function () {
                    $.async(self.telephoneSelector, function (telephoneField) {
                        let billingAddress = quote.billingAddress(),
                            initialCountry = billingAddress
                                ? billingAddress.countryId.toLowerCase()
                                : quote.shippingAddress().countryId.toLowerCase();
                        self.iti = window.intlTelInput(telephoneField, {
                            preferredCountries: _.uniq([initialCountry, ...self.supportedCountryCodes]),
                            utilsScript: config.internationalTelephoneConfig.utilsScript,
                            initialCountry: initialCountry,
                            separateDialCode: true
                        });
                        $(telephoneField).on('change countrychange', function () {
                            self.setFullTelephone();
                        });
                        self.countryCode.subscribe((countryCode) => {
                            self.setFullTelephone(countryCode);
                        });
                        self.setFullTelephone();
                    });
                });
            },
            setFullTelephone: function (countryCode = null) {
                /**
                 * Note 1! Origin method "getInstance" doesn't work as described in:
                 *         https://github.com/jackocnr/intl-tel-input#static-methods
                 * Note 2! "iti" will be initialized correctly when only 1 telephone is initialized at the web page
                 * Note 3! this logic can't be replaced with "iti.hiddenInput" because it doesn't work as expected
                 */
                if (this.iti) {
                    if (countryCode) {
                        this.iti.setCountry(countryCode);
                    }
                    // window.intlTelInputUtils.numberFormat.E164
                    const E164 = 0;
                    this.telephone(this.iti.getNumber(E164));
                }
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
                const companyIdSelector = $(this.companyIdSelector)
                companyIdSelector.val('')
                companyIdSelector.prop('disabled', false);
                const companyNameSelector = $(this.companyNameSelector)
                companyNameSelector.val(this.companyName());
                if (companyNameSelector.data('select2')) {
                    companyNameSelector.select2('destroy');
                    companyNameSelector.attr('type', 'text');
                }
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

                return fetch(URL, OPTIONS)
                .then((response) => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        throw new Error(`Error response from ${URL}.`);
                    }
                })
                .then((json) => {
                    return json[0];
                })
                .catch((e) => {
                    console.error(e);
                    throw e;
                });
            },

            getAutofillData() {
                const billingAddress = quote.billingAddress();
                const _street = billingAddress.street.filter((s) => s).join(", ").split(" ");
                const building = _street[0].replace(',', '');
                const street = _street.slice(1, _street.length).join(" ");
                const data = {
                  email: this.getEmail(),
                  first_name: billingAddress.firstname,
                  last_name: billingAddress.lastname,
                  company_name: this.companyName(),
                  phone_number: this.telephone(),
                  billing_address: {
                    building: building,
                    street: street,
                    postal_code: billingAddress.postcode,
                    city: billingAddress.city,
                    region: billingAddress.region,
                    country_code: billingAddress.countryId,
                  },
                };
                return btoa(JSON.stringify(data));
            },

            openIframe() {
                const data = this.getAutofillData();
                const URL = config.popup_url + `/soletrader/signup?businessToken=${this.token.delegation}&autofillToken=${this.token.autofill}&autofillData=${data}`;
                const windowFeatures = 'location=yes,resizable=yes,scrollbars=yes,status=yes, height=805, width=610';
                window.open(URL, '_blank', windowFeatures);
            },

            flashSoleTraderErrorMessage () {
                this.showSoleTraderErrorMessage(true);
                setTimeout(() => this.showSoleTraderErrorMessage(false), 5000);
            },

            registeredOrganisationMode() {
                if (this.isCompanyNameAutoCompleteEnabled) {
                    this.enableCompanyAutoComplete();
                }
                this.fillCustomerData();
                this.showSoleTrader(false);
            },

            soleTraderMode() {
                this.clearCompany();
                this.getTokens()
                .then((json) => {
                    console.log(json);
                    this.token.delegation = json.delegation_token;
                    this.token.autofill = json.autofill_token;
                    this.getCurrentBuyer();
                    this.showSoleTrader(true);
                    $(this.searchForCompanyButton).hide()
                })
                .catch(() => this.flashSoleTraderErrorMessage());
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
                        return null;
                    } else {
                        throw new Error(`Error response from ${URL}.`);
                    }
                })
                .then((json) => {
                    if (json) {
                        const email = this.getEmail();
                        if (json.email == email) {
                            // Only autofill if email matches
                            $('#select2-two_company_name-container').html(json.company_name);
                            this.companyName(json.company_name);
                            this.companyId(json.organization_number);
                            $(this.companyIdSelector).prop('disabled', true);
                        } else {
                            this.showPopupMessage(true);
                        }
                    } else {
                        this.showPopupMessage(true);
                    }
                })
                .catch(() => {
                    this.flashSoleTraderErrorMessage();
                });
            },

            addVerifyEvent() {
                window.addEventListener("message", (event) => {
                    if (event.data === 'ACCEPTED') {
                        this.getCurrentBuyer();
                    } else {
                        this.flashSoleTraderErrorMessage();
                    }
                });
            }
        });
    }
);

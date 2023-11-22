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
], function (
    ko,
    $,
    _,
    Component,
    quote,
    customerData,
    stepNavigator,
    uiRegistry,
    additionalValidators,
    $t,
    fullScreenLoader,
    redirectOnSuccessAction,
    url
) {
    'use strict';

    let config = window.checkoutConfig.payment.two_payment;
    window.quote = quote;

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
        soleTraderCountryCodes: ['gb'],
        companyName: ko.observable(''),
        companyId: ko.observable(''),
        project: ko.observable(''),
        department: ko.observable(''),
        orderNote: ko.observable(''),
        poNumber: ko.observable(''),
        telephone: ko.observable(''),
        fullTelephone: ko.observable(''),
        countryCode: ko.observable(''),
        iti: null,
        formSelector: 'form#two_gateway_form',
        telephoneSelector: 'input#two_telephone',
        companyNameSelector: 'input#company_name',
        companyIdSelector: 'input#company_id',
        generalErrorMessage: $t(
            'Something went wrong with your request to Two. Please try again later.'
        ),
        soleTraderErrorMessage: $t(
            'Something went wrong with your request to Two. Your sole trader account could not be verified.'
        ),
        enterDetailsManuallyText: $t('Enter details manually'),
        enterDetailsManuallyButton: '#billing_enter_details_manually',
        searchForCompanyText: $t('Search for company'),
        searchForCompanyButton: '#billing_search_for_company',
        delegationToken: '',
        autofillToken: '',
        showPopupMessage: ko.observable(false),
        showSoleTrader: ko.observable(false),
        showWhatIsTwo: ko.observable(false),
        showModeTab: ko.observable(false),

        initialize: function () {
            this._super();
            if (this.isInternationalTelephoneEnabled) {
                this.enableInternationalTelephone();
            }
            this.registeredOrganisationMode();
            this.configureFormValidation();
            this.addVerifyEvent();
        },
        fillCompanyName: function (self, companyName) {
            const billingAddress = quote.billingAddress();
            const fallbackCompanyName =
                typeof billingAddress.company == 'string' ? billingAddress.company : '';
            companyName =
                typeof companyName == 'string' && companyName ? companyName : fallbackCompanyName;
            self.companyName(companyName);
            $(self.companyNameSelector).val(companyName);
            $('#select2-company_name-container')?.text(companyName);
        },
        fillCompanyId: function (self, companyId) {
            companyId = typeof companyId == 'string' ? companyId : '';
            self.companyId(companyId);
        },
        fillTelephone: function (self, telephone) {
            telephone = typeof telephone == 'string' ? telephone : '';
            self.telephone(telephone);
        },
        fillCountryCode: function (self, countryCode) {
            countryCode = typeof countryCode == 'string' ? countryCode : '';
            self.countryCode(countryCode);
            if (self.soleTraderCountryCodes.includes(countryCode.toLowerCase())) {
                self.showModeTab(true);
            } else {
                if (self.showSoleTrader()) {
                    self.registeredOrganisationMode();
                }
                self.showModeTab(false);
            }
        },
        updateAddress: function (self, address) {
            if (!address) return;
            let telephone = (address.telephone || '').replace(' ', '');
            let companyName = address.company;
            let companyId = '';
            let department = '';
            let project = '';
            if (Array.isArray(address.customAttributes)) {
                address.customAttributes.forEach(function (item) {
                    console.log(item);
                    if (item.attribute_code == 'company_id') {
                        companyId = item.value;
                    }
                    if (item.attribute_code == 'company_name') {
                        companyName = item.value;
                    }
                    if (item.attribute_code == 'two_telephone') {
                        telephone = telephone;
                    }
                    if (item.attribute_code == 'project') {
                        project = item.value;
                    }
                    if (item.attribute_code == 'department') {
                        department = item.value;
                    }
                });
            }
            if (telephone) self.fillTelephone(self, telephone);
            if (companyName) {
                self.fillCompanyName(self, companyName);
                self.fillCompanyId(self, companyId);
            }
            if (project) self.project(project);
            if (department) self.department(department);
        },
        updateShippingAddress: function (self, shippingAddress) {
            console.log({ shippingAddress });
            if (shippingAddress.getCacheKey() == quote.billingAddress().getCacheKey()) {
                self.updateAddress(self, shippingAddress);
            }
        },
        updateBillingAddress: function (self, billingAddress) {
            console.log({ billingAddress });
            self.updateAddress(self, billingAddress);
        },
        fillCustomerData: function () {
            quote.shippingAddress.subscribe((address) => this.updateShippingAddress(this, address));
            this.updateShippingAddress(this, quote.shippingAddress());

            quote.billingAddress.subscribe((address) => this.updateBillingAddress(this, address));
            this.updateBillingAddress(this, quote.billingAddress());

            customerData
                .get('twoCompanyName')
                .subscribe((companyName) => this.fillCompanyName(this, companyName));
            this.fillCompanyName(this, customerData.get('twoCompanyName')());

            customerData
                .get('twoCompanyId')
                .subscribe((companyId) => this.fillCompanyId(this, companyId));
            this.fillCompanyId(this, customerData.get('twoCompanyId')());

            customerData
                .get('twoTelephone')
                .subscribe((telephone) => this.fillTelephone(this, telephone));
            this.fillTelephone(this, customerData.get('twoTelephone')());

            customerData
                .get('twoCountryCode')
                .subscribe((countryCode) => this.fillCountryCode(this, countryCode));
            this.fillCountryCode(this, customerData.get('twoCountryCode')());
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
            if (
                self.validate() &&
                additionalValidators.validate() &&
                self.isPlaceOrderActionAllowed() === true
            ) {
                if (this.isOrderIntentEnabled) {
                    fullScreenLoader.startLoader();
                    this.placeIntentOrder()
                        .always(function () {
                            fullScreenLoader.stopLoader();
                        })
                        .done(function (response) {
                            self.processIntentSuccessResponse(response);
                        })
                        .error(function (response) {
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
            return this.getPlaceOrderDeferredObject()
                .done(function () {
                    self.afterPlaceOrder();
                    if (self.redirectAfterPlaceOrder) {
                        redirectOnSuccessAction.execute();
                    }
                })
                .always(function () {
                    self.isPlaceOrderActionAllowed(true);
                });
        },
        processIntentSuccessResponse: function (response) {
            if (response) {
                if (response.approved) {
                    this.placeOrderBackend();
                } else {
                    this.showErrorMessage(this.getDeclinedErrorMessage(response.decline_reason));
                }
            } else {
                this.showErrorMessage(this.generalErrorMessage);
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
                this.showErrorMessage(message);
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
                    name: item['name'],
                    description: item['description'] ? item['description'] : '',
                    discount_amount: parseFloat(item['discount_amount']).toFixed(2),
                    gross_amount: parseFloat(item['row_total_incl_tax']).toFixed(2),
                    net_amount: parseFloat(item['row_total']).toFixed(2),
                    quantity: item['qty'],
                    unit_price: parseFloat(item['price']).toFixed(2),
                    tax_amount: parseFloat(item['tax_amount']).toFixed(2),
                    tax_rate: parseFloat(item['tax_percent']).toFixed(6),
                    tax_class_name: '',
                    quantity_unit: config.intentOrderConfig.weightUnit,
                    image_url: item['thumbnail'],
                    type: item['is_virtual'] === '0' ? 'PHYSICAL' : 'DIGITAL'
                });
            });
            return $.ajax({
                url:
                    config.intentOrderConfig.host +
                    '/v1/order_intent?' +
                    'client=' +
                    config.intentOrderConfig.extensionPlatformName +
                    '&client_v=' +
                    config.intentOrderConfig.extensionDBVersion,
                type: 'POST',
                global: true,
                contentType: 'application/json',
                headers: {},
                data: JSON.stringify({
                    gross_amount: parseFloat(totals['grand_total']).toFixed(2),
                    invoice_type: config.intentOrderConfig.invoiceType,
                    currency: totals['base_currency_code'],
                    line_items: lineItems,
                    buyer: {
                        company: {
                            organization_number: this.companyId(),
                            country_prefix: billingAddress.countryId,
                            company_name: this.companyName(),
                            website: window.BASE_URL
                        },
                        representative: {
                            email: this.getEmail(),
                            first_name: billingAddress.firstname,
                            last_name: billingAddress.lastname,
                            phone_number: this.getTelephone()
                        }
                    },
                    merchant_short_name: config.intentOrderConfig.merchantShortName
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
                method: this.getCode(),
                additional_data: {
                    companyName: this.companyName(),
                    companyId: this.companyId(),
                    project: this.project(),
                    department: this.department(),
                    orderNote: this.orderNote(),
                    poNumber: this.poNumber(),
                    telephone: this.getTelephone() // checkout-data -> shippingAddressFromData -> custom_attributes -> two_telephone_full
                }
            };
        },
        enableCompanyAutoComplete: function () {
            let self = this;
            require(['Two_Gateway/select2-4.1.0/js/select2.min'], function () {
                $.async(self.companyIdSelector, function (companyIdField) {
                    $(companyIdField).prop('disabled', true);
                });
                $.async(self.companyNameSelector, function (companyNameField) {
                    var searchLimit = config.companyAutoCompleteConfig.searchLimit;
                    $(companyNameField)
                        .select2({
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
                                    if (
                                        billingAddress &&
                                        billingAddress.countryId &&
                                        searchHosts[billingAddress.countryId.toLowerCase()]
                                    ) {
                                        searchHost =
                                            searchHosts[billingAddress.countryId.toLowerCase()];
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
                                        `<div id="billing_enter_details_manually" class="enter_details_manually" title="${self.enterDetailsManuallyText}">` +
                                            `<span>${self.enterDetailsManuallyText}</span>` +
                                            '</div>'
                                    );
                                $(self.enterDetailsManuallyButton).on('click', function (e) {
                                    self.clearCompany();
                                    $(self.searchForCompanyButton).show();
                                });
                            }
                            document.querySelector('.select2-search__field').focus();
                        })
                        .on('select2:select', function (e) {
                            var selectedItem = e.params.data;
                            self.fillCompanyName(self, selectedItem.text);
                            self.fillCompanyId(self, selectedItem.companyId);
                        });
                    $('#select2-company_name-container').text(self.companyName());
                    if ($(self.searchForCompanyButton).length == 0) {
                        $(self.companyNameSelector)
                            .closest('.field')
                            .append(
                                `<div id="billing_search_for_company" class="search_for_company" title="${self.searchForCompanyText}">` +
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
        },
        enableInternationalTelephone: function () {
            let self = this;
            require(['intlTelInput'], function () {
                $.async(self.telephoneSelector, function (telephoneField) {
                    let billingAddress = quote.billingAddress(),
                        initialCountry = billingAddress
                            ? billingAddress.countryId.toLowerCase()
                            : quote.shippingAddress().countryId.toLowerCase();
                    self.iti = window.intlTelInput(telephoneField, {
                        preferredCountries: _.uniq([initialCountry, ...self.supportedCountryCodes]),
                        utilsScript: config.internationalTelephoneConfig.utilsScript,
                        initialCountry: initialCountry,
                        nationalMode: true
                    });
                    $(self.telephoneSelector).on('change keyup countrychange', function () {
                        self.setFullTelephone();
                    });
                    self.telephone.subscribe((telephone) => {
                        self.setFullTelephone({ telephone });
                    });
                    self.countryCode.subscribe((countryCode) => {
                        self.setFullTelephone({ countryCode });
                    });
                    self.setFullTelephone();
                });
            });
        },
        getTelephone: function () {
            const telephone = this.fullTelephone() || this.telephone();
            console.log({ telephone });
            return telephone;
        },
        setFullTelephone: function ({ telephone = null, countryCode = null } = {}) {
            /**
             * Note 1! Origin method "getInstance" doesn't work as described in:
             *         https://github.com/jackocnr/intl-tel-input#static-methods
             * Note 2! "iti" will be initialized correctly when only 1 telephone is initialized at the web page
             * Note 3! this logic can't be replaced with "iti.hiddenInput" because it doesn't work as expected
             */
            const iti = this.iti;
            iti.promise.then(() => {
                if (countryCode) {
                    iti.setCountry(countryCode);
                }
                if (telephone) {
                    iti.setNumber(telephone);
                }
                const fullTelephone = iti.getNumber();
                const valid = iti.isValidNumber();
                console.log({ fullTelephone, valid, countryCode, telephone });
                this.fullTelephone(fullTelephone);
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
        clearCompany: function (disableCompanyId = false) {
            const companyIdSelector = $(this.companyIdSelector);
            companyIdSelector.val('');
            companyIdSelector.prop('disabled', disableCompanyId);
            const companyNameSelector = $(this.companyNameSelector);
            companyNameSelector.val('');
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
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cartId: quote.getQuoteId() })
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
            const _street = billingAddress.street
                .filter((s) => s)
                .join(', ')
                .split(' ');
            const building = _street[0].replace(',', '');
            const street = _street.slice(1, _street.length).join(' ');
            const data = {
                email: this.getEmail(),
                first_name: billingAddress.firstname,
                last_name: billingAddress.lastname,
                company_name: this.companyName(),
                phone_number: this.getTelephone(),
                billing_address: {
                    building: building,
                    street: street,
                    postal_code: billingAddress.postcode,
                    city: billingAddress.city,
                    region: billingAddress.region,
                    country_code: billingAddress.countryId
                }
            };
            return btoa(JSON.stringify(data));
        },

        openIframe() {
            const data = this.getAutofillData();
            const URL =
                config.popup_url +
                `/soletrader/signup?businessToken=${this.delegationToken}&autofillToken=${this.autofillToken}&autofillData=${data}`;
            const windowFeatures =
                'location=yes,resizable=yes,scrollbars=yes,status=yes, height=805, width=610';
            window.open(URL, '_blank', windowFeatures);
        },

        showErrorMessage(message) {
            this.messageContainer.addErrorMessage({ message });
        },

        registeredOrganisationMode() {
            this.showSoleTrader(false);
            if (this.isCompanyNameAutoCompleteEnabled) {
                this.enableCompanyAutoComplete();
            }
            this.fillCustomerData();
        },

        soleTraderMode() {
            this.showSoleTrader(true);
            this.clearCompany(true);
            this.getTokens()
                .then((json) => {
                    console.log(json);
                    this.delegationToken = json.delegation_token;
                    this.autofillToken = json.autofill_token;
                    this.getCurrentBuyer();
                    $(this.searchForCompanyButton).hide();
                })
                .catch(() => this.showErrorMessage(this.soleTraderErrorMessage));
        },

        getCurrentBuyer() {
            const URL = config.api_url + '/autofill/v1/buyer/current';
            const OPTIONS = {
                credentials: 'include',
                headers: {
                    'two-delegated-authority-token': this.autofillToken
                }
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
                            $('#select2-company_name-container').text(json.company_name);
                            this.companyName(json.company_name);
                            this.companyId(json.organization_number);
                            this.showPopupMessage(false);
                        } else {
                            this.showPopupMessage(true);
                        }
                    } else {
                        this.showPopupMessage(true);
                    }
                })
                .catch(() => this.showErrorMessage(this.soleTraderErrorMessage));
        },

        addVerifyEvent() {
            window.addEventListener('message', (event) => {
                if (event.data === 'ACCEPTED') {
                    this.getCurrentBuyer();
                } else {
                    this.showErrorMessage(this.soleTraderErrorMessage);
                }
            });
        }
    });
});

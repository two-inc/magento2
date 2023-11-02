var config = {
    paths: {
        "intlTelInput": 'Two_Gateway/intl-tel-input-18.2.1/js/intlTelInput.min',
    },
    shim: {
        'intlTelInput': {
            'deps': ['jquery']
        }
    },
    config: {
        mixins: {
            'Magento_Checkout/js/action/set-shipping-information': {
                'Two_Gateway/js/action/set-shipping-information-mixin': true
            }
        }
    }
};

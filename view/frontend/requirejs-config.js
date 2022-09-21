var config = {
    paths: {
        "intlTelInput": 'Two_Gateway/js/international-telephone/intlTelInput',
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

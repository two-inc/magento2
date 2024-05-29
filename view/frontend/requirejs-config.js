var config = {
    paths: {},
    shim: {},
    config: {
        mixins: {
            'Magento_Checkout/js/action/set-shipping-information': {
                'Two_Gateway/js/action/set-shipping-information-mixin': true
            }
        }
    }
};

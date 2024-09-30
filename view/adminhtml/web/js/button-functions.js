require(['jquery', 'Magento_Ui/js/modal/modal', 'prototype', 'loader'], function ($, modal) {
    /**
     * @param{String} modalSelector - modal css selector.
     * @param{Object} options - modal options.
     */
    function initModal(modalSelector, options) {
        var $resultModal = $(modalSelector);

        if (!$resultModal.length) return;

        var popup = modal(options, $resultModal);
        $resultModal.loader({ texts: '' });
    }

    var successHandlers = {
        /**
         * @param{Object[]} result - Ajax request response data.
         * @param{Object} $container - jQuery container element.
         */
        debug: function (result, $container) {
            if (Array.isArray(result)) {
                var lisHtml = result
                    .map(function (err) {
                        return (
                            '<li class="two-result_debug-item"><strong>' +
                            err.date +
                            '</strong><p>' +
                            err.msg +
                            '</p></li>'
                        );
                    })
                    .join('');

                $container
                    .find('.result')
                    .empty()
                    .append('<ul>' + lisHtml + '</ul>');
            } else {
                $container.find('.result').empty().append(result);
            }
        },

        /**
         * @param{Object[]} result - Ajax request response data.
         * @param{Object} $container - jQuery container element.
         */
        error: function (result, $container) {
            if (Array.isArray(result)) {
                var lisHtml = result
                    .map(function (err) {
                        return (
                            '<li class="two-result_error-item"><strong>' +
                            err.date +
                            '</strong><p>' +
                            err.msg +
                            '</p></li>'
                        );
                    })
                    .join('');

                $container
                    .find('.result')
                    .empty()
                    .append('<ul>' + lisHtml + '</ul>');
            } else {
                $container.find('.result').empty().append(result);
            }
        }
    };

    // init debug modal
    $(() => {
        initModal('#two-result_debug-modal', {
            type: 'popup',
            responsive: true,
            innerScroll: true,
            title: $.mage.__('Last 100 debug log lines'),
            buttons: [
                {
                    text: $.mage.__('Download as .txt file'),
                    class: 'two-button__download two-icon__download-alt',
                    click: function () {
                        var elText = document.getElementById('two-result_debug').innerText || '';
                        var link = document.createElement('a');

                        link.setAttribute('download', 'debug-log.txt');
                        link.setAttribute(
                            'href',
                            'data:text/plain;charset=utf-8,' + encodeURIComponent(elText)
                        );
                        link.click();
                    }
                },
                {
                    text: $.mage.__('OK'),
                    class: '',
                    click: function () {
                        this.closeModal();
                    }
                }
            ]
        });

        // init error modal
        initModal('#two-result_error-modal', {
            type: 'popup',
            responsive: true,
            innerScroll: true,
            title: $.mage.__('Last 100 error log records'),
            buttons: [
                {
                    text: $.mage.__('Download as .txt file'),
                    class: 'two-button__download two-icon__download-alt',
                    click: function () {
                        var elText = document.getElementById('two-result_error').innerText || '';
                        var link = document.createElement('a');

                        link.setAttribute('download', 'error-log.txt');
                        link.setAttribute(
                            'href',
                            'data:text/plain;charset=utf-8,' + encodeURIComponent(elText)
                        );
                        link.click();
                    }
                },
                {
                    text: $.mage.__('OK'),
                    class: '',
                    click: function () {
                        this.closeModal();
                    }
                }
            ]
        });
    });

    /**
     * Ajax request event
     */
    $(document).on('click', '[id^=two-button]', function () {
        var actionName = this.id.split('_')[1];
        var $modal = $('#two-result_' + actionName + '-modal');
        var $result = $('#two-result_' + actionName);

        $modal.modal('openModal').loader('show');

        $result.hide();

        new Ajax.Request($modal.data('two-endpoind-url'), {
            loaderArea: false,
            asynchronous: true,
            onSuccess: function (response) {
                if (response.status > 200) {
                    var result = response.statusText;
                } else {
                    successHandlers[actionName](
                        response.responseJSON.result || response.responseJSON,
                        $result
                    );

                    $result.fadeIn();
                    $modal.loader('hide');
                }
            }
        });
    });
});

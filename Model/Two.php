<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Model;

use Exception;
use Magento\Framework\Api\AttributeValueFactory;
use Magento\Framework\Api\ExtensionAttributesFactory;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Data\Collection\AbstractDb;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Model\Context;
use Magento\Framework\Model\ResourceModel\AbstractResource;
use Magento\Framework\Phrase;
use Magento\Framework\Registry;
use Magento\Payment\Helper\Data;
use Magento\Payment\Model\InfoInterface;
use Magento\Payment\Model\Method\AbstractMethod;
use Magento\Payment\Model\Method\Logger;
use Magento\Quote\Api\Data\CartInterface;
use Magento\Sales\Api\OrderStatusHistoryRepositoryInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Status\HistoryFactory;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Service\Api\Adapter;
use Two\Gateway\Service\Order\ComposeCapture;
use Two\Gateway\Service\Order\ComposeOrder;
use Two\Gateway\Service\Order\ComposeRefund;
use Two\Gateway\Service\UrlCookie;
use Two\Gateway\Api\Log\RepositoryInterface as LogRepository;

/**
 * Two Payment Model
 */
class Two extends AbstractMethod
{
    public const CODE = 'two_payment';

    public const STATUS_NEW = 'two_new';
    public const STATUS_FAILED = 'two_failed';
    public const STATUS_APPROVED = 'APPROVED';
    /**
     * @var RequestInterface
     */
    public $request;
    protected $_code = self::CODE;
    /**
     * @var bool
     */
    protected $_canUseInternal = false;
    /**
     * @var bool
     */
    protected $_canVoid = true;
    /**
     * @var bool
     */
    protected $_isGateway = true;
    /**
     * @var bool
     */
    protected $_canRefund = true;
    /**
     * @var bool
     */
    protected $_canCapture = true;
    /**
     * @var bool
     */
    protected $_canRefundInvoicePartial = true;
    /**
     * @var ConfigRepository
     */
    private $configRepository;
    /**
     * @var UrlCookie
     */
    private $urlCookie;
    /**
     * @var ComposeOrder
     */
    private $compositeOrder;
    /**
     * @var ComposeRefund
     */
    private $composeRefund;
    /**
     * @var ComposeCapture
     */
    private $composeCapture;
    /**
     * @var Adapter
     */
    private $apiAdapter;
    /**
     * @var HistoryFactory
     */
    private $historyFactory;

    /**
     * @var OrderStatusHistoryRepositoryInterface
     */
    private $orderStatusHistoryRepository;
    /**
     * @var LogRepository
     */
    private $logRepository;

    /**
     * Two constructor.
     *
     * @param RequestInterface $request
     * @param Context $context
     * @param Registry $registry
     * @param ExtensionAttributesFactory $extensionFactory
     * @param AttributeValueFactory $customAttributeFactory
     * @param ConfigRepository $configRepository
     * @param Data $paymentData
     * @param ScopeConfigInterface $scopeConfig
     * @param Logger $logger
     * @param UrlCookie $urlCookie
     * @param ComposeOrder $composeOrder
     * @param ComposeRefund $composeRefund
     * @param ComposeCapture $composeCapture
     * @param HistoryFactory $historyFactory
     * @param OrderStatusHistoryRepositoryInterface $orderStatusHistoryRepository
     * @param Adapter $apiAdapter
     * @param LogRepository $logRepository
     * @param AbstractResource|null $resource
     * @param AbstractDb|null $resourceCollection
     * @param array $data
     */
    public function __construct(
        RequestInterface $request,
        Context $context,
        Registry $registry,
        ExtensionAttributesFactory $extensionFactory,
        AttributeValueFactory $customAttributeFactory,
        ConfigRepository $configRepository,
        Data $paymentData,
        ScopeConfigInterface $scopeConfig,
        Logger $logger,
        UrlCookie $urlCookie,
        ComposeOrder $composeOrder,
        ComposeRefund $composeRefund,
        ComposeCapture $composeCapture,
        HistoryFactory $historyFactory,
        OrderStatusHistoryRepositoryInterface $orderStatusHistoryRepository,
        Adapter $apiAdapter,
        LogRepository $logRepository,
        AbstractResource $resource = null,
        AbstractDb $resourceCollection = null,
        array $data = []
    ) {
        $this->request = $request;
        parent::__construct(
            $context,
            $registry,
            $extensionFactory,
            $customAttributeFactory,
            $paymentData,
            $scopeConfig,
            $logger,
            $resource,
            $resourceCollection,
            $data
        );
        $this->configRepository = $configRepository;
        $this->urlCookie = $urlCookie;
        $this->compositeOrder = $composeOrder;
        $this->composeRefund = $composeRefund;
        $this->composeCapture = $composeCapture;
        $this->apiAdapter = $apiAdapter;
        $this->historyFactory = $historyFactory;
        $this->orderStatusHistoryRepository = $orderStatusHistoryRepository;
        $this->logRepository = $logRepository;
    }

    /**
     * Authorize the transaction
     *
     * @param InfoInterface $payment
     * @param float $amount
     * @return $this|Two
     * @throws LocalizedException
     */
    public function authorize(InfoInterface $payment, $amount)
    {
        $order = $payment->getOrder();
        $this->urlCookie->delete();
        $orderReference = (string)rand();
        $payload = $this->compositeOrder->execute(
            $order,
            $orderReference,
            $payment->getAdditionalInformation()
        );

        // Create order
        $response = $this->apiAdapter->execute('/v1/order', $payload);
        $error = $this->getErrorFromResponse($response);
        if ($error) {
            throw new LocalizedException($error);
        }

        if ($response['status'] !== static::STATUS_APPROVED) {
            $this->logRepository->addDebugLog('Order was not accepted', $response);
            throw new LocalizedException(__('Your order was not accepted'));
        }

        $order->setTwoOrderReference($orderReference);
        $order->setTwoOrderId($response['id']);
        $payload['gateway_data']['external_order_id'] = $response['id'];
        $payload['gateway_data']['external_order_status'] = $response['external_order_status'];
        $payload['gateway_data']['original_order_id'] = $response['original_order_id'];
        $payload['gateway_data']['state'] = $response['state'];
        $payload['gateway_data']['status'] = $response['status'];

        //remove unnecessary data before save in database
        unset($payload['line_items']);
        unset($payload['shipping_address']);
        unset($payload['billing_address']);
        unset($payload['merchant_urls']);

        $payment->setAdditionalInformation($payload);
        $payment->setTransactionId($response['external_order_id'])
            ->setIsTransactionClosed(0)
            ->setIsTransactionPending(true);
        $this->urlCookie->set($response['payment_url']);
        return $this;
    }

    /**
     * Get error from response
     *
     * @param $response
     * @return Phrase|null
     */
    public function getErrorFromResponse(array $response): ?Phrase
    {
        $generalMessage = __('Something went wrong. Please try again.');
        if (!$response || !is_array($response)) {
            return $generalMessage;
        }

        if (!empty($response['error_code'])) {
            $message = $response['error_message'];
            if (!empty($response['error_details'])) {
                $message .= ' - ' . $response['error_details'];
            }

            return __($message);
        }

        if (empty($response['id'])) {
            return $generalMessage;
        }

        return null;
    }

    /**
     * @inheritDoc
     */
    public function void(InfoInterface $payment)
    {
        return $this->cancel($payment);
    }

    /**
     * @inheritDoc
     */
    public function cancel(InfoInterface $payment)
    {
        /** @var Order $order */
        $order = $payment->getOrder();
        try {
            $twoOrderId = $order->getTwoOrderId();
            $response = $this->apiAdapter->execute('/v1/order/' . $order->getTwoOrderId() . '/cancel');
            if ($response) {
                $error = $this->getErrorFromResponse($response);
                $order->addStatusToHistory(
                    $order->getStatus(),
                    __(
                        'Could not update status to cancelled, please check with Two admin for id %1. Error - %2',
                        $twoOrderId,
                        $error
                    )
                );
            } else {
                $order->addStatusToHistory($order->getStatus(), __('Two Order marked as cancelled'));
            }

            $order->save();
        } catch (LocalizedException $e) {
            $order->addStatusToHistory($order->getStatus(), $e->getMessage());
        }

        return $this;
    }

    /**
     * @inheritDoc
     */
    public function capture(InfoInterface $payment, $amount)
    {
        if ($this->canCapture()) {
            /** @var Order $order */
            $order = $payment->getOrder();
            $twoOrderId = $order->getTwoOrderId();
            if (!$twoOrderId) {
                throw new LocalizedException(
                    __('Could not initiate capture by Two')
                );
            }
            $orderItems = $order->getAllVisibleItems();
            $wholeOrderInvoiced = 1;
            if ($orderItems) {
                foreach ($orderItems as $item) {
                    if ($item->getQtyInvoiced() < $item->getQtyOrdered()) {
                        $wholeOrderInvoiced = 0;
                        break;
                    }
                }
            }

            if ($wholeOrderInvoiced == 1) {
                $response = $this->apiAdapter->execute('/v1/order/' . $twoOrderId . '/fulfilled');
            } else {
                $invoices = $order->getInvoiceCollection();
                $totalInvoices = count($invoices);
                $cnt = 1;
                $createdInvoice = null;
                foreach ($invoices as $invoice) {
                    if ($cnt == $totalInvoices) {
                        $createdInvoice = $invoice;
                    }
                    $cnt++;
                }
                $remainItemInvoice = $payment->getOrder()->prepareInvoice();
                $response = $this->partialMainOrder($order, $createdInvoice, $remainItemInvoice);
            }

            if (!empty($response) && isset($response['id'])) {
                $payment->setTransactionId($response['id'])->setIsTransactionClosed(0);
            } else {
                $payment->setIsTransactionClosed(0);
            }
            $this->parseFulfillResponse($response, $order);
            $payment->save();

            $error = $this->getErrorFromResponse($response);
            if ($error) {
                throw new LocalizedException($error);
            }
        } else {
            throw new LocalizedException(__('The capture action is not available.'));
        }
        return $this;
    }

    /**
     * @inheritDoc
     */
    public function canCapture()
    {
        return $this->_canCapture && ($this->configRepository->getFulfillOrderType() == 'invoice');
    }

    /**
     * Partial Capture
     *
     * @param Order $order
     * @param Order\Invoice|null $invoice
     * @param Order\Invoice $remainItemInvoice
     * @return array
     * @throws LocalizedException
     */
    public function partialMainOrder(Order $order, ?Order\Invoice $invoice, Order\Invoice $remainItemInvoice): array
    {
        $twoOrderId = $order->getTwoOrderId();

        $payload['partially_fulfilled_order'] = $this->composeCapture->execute(
            $order,
            $this->configRepository->getDueInDays(),
            $invoice
        );

        $payload['remained_order'] = $this->composeCapture->execute(
            $order,
            $this->configRepository->getDueInDays(),
            $remainItemInvoice
        );

        /* Partially fulfill order*/
        return $this->apiAdapter->execute('/v1/order/' . $twoOrderId . '/fulfilled', $payload);
    }

    /**
     * Parse Fulfill Response
     *
     * @param array $response
     * @param Order $order
     * @return void
     * @throws Exception
     */
    private function parseFulfillResponse(array $response, Order $order): void
    {
        $error = $order->getPayment()->getMethodInstance()->getErrorFromResponse($response);

        if ($error) {
            throw new LocalizedException($error);
        }

        if (empty($response['invoice_details'] ||
            empty($response['invoice_details']['invoice_number']))) {
            return;
        }

        $additionalInformation = $order->getPayment()->getAdditionalInformation();
        $additionalInformation['gateway_data']['invoice_number'] = $response['invoice_details']['invoice_number'];
        $additionalInformation['gateway_data']['invoice_url'] = $response['invoice_url'];
        $additionalInformation['marked_completed'] = true;

        $order->getPayment()->setAdditionalInformation($additionalInformation);

        $this->addStatusToOrderHistory(
            $order,
            sprintf(
                'Two Order marked as completed with invoice number %s',
                $response['invoice_details']['invoice_number']
            )
        );
    }

    /**
     * Add order status to history
     *
     * @param Order $order
     * @param string $comment
     * @throws Exception
     */
    private function addStatusToOrderHistory(Order $order, string $comment)
    {
        $history = $this->historyFactory->create();
        $history->setParentId($order->getEntityId())
            ->setComment($comment)
            ->setEntityName('order')
            ->setStatus($order->getStatus());
        $this->orderStatusHistoryRepository->save($history);
    }

    /**
     * @inheritDoc
     */
    public function refund(InfoInterface $payment, $amount)
    {
        $order = $payment->getOrder();
        $twoOrderId = $order->getTwoOrderId();
        if (!$twoOrderId) {
            throw new LocalizedException(
                __('Could not initiate refund by Two')
            );
        }

        $billingAddress = $order->getBillingAddress();
        if ($billingAddress->getCountryId() == 'NO') {
            $langParams = '?lang=nb_NO';
        } else {
            $langParams = '?lang=en_US';
        }

        $payload = $this->composeRefund->execute(
            $payment->getCreditmemo(),
            (double)$amount,
            $order
        );
        $response = $this->apiAdapter->execute(
            "/v1/order/" . $twoOrderId . "/refund" . $langParams,
            $payload
        );

        $error = $this->getErrorFromResponse($response);
        if ($error) {
            $this->addOrderComment($order, $error);
            throw new LocalizedException($error);
        }

        if (!$response['amount']) {
            $message = __('Failed to refund order by Two. Amount is missing');
            $this->addOrderComment($order, $message);
            throw new  LocalizedException(
                $message
            );
        }

        $additionalInformation = $payment->getAdditionalInformation();
        $additionalInformation['gateway_data']['credit_note_url'] = $response['credit_note_url'];
        $payment->setAdditionalInformation($additionalInformation);

        $order->addStatusToHistory(
            $order->getStatus(),
            __(
                'Successfully refunded order Two admin for id %1. Refund id is %2',
                $twoOrderId,
                $response['refund_no']
            )
        )->save();
        return $this;
    }

    /**
     * @param Order $order
     * @param $message
     */
    public function addOrderComment(Order $order, $message)
    {
        $order->addStatusToHistory($order->getStatus(), $message);
    }

    /**
     * @inheritDoc
     */
    public function isAvailable(CartInterface $quote = null)
    {
        if (!$this->configRepository->isActive()
            || $this->configRepository->getApiKey() == '') {
            return false;
        }

        return parent::isAvailable($quote);
    }
}

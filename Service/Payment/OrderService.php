<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service\Payment;

use Exception;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\DB\Transaction;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Url\DecoderInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Invoice;
use Magento\Sales\Model\OrderFactory;
use Magento\Sales\Model\ResourceModel\Order as OrderResource;
use Magento\Sales\Model\Service\InvoiceService;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Model\Two;
use Two\Gateway\Service\Api\Adapter;
use Two\Gateway\Service\UrlCookie;

/**
 * Payment Order Service
 */
class OrderService
{
    /**
     * @var Adapter
     */
    private $apiAdapter;

    /**
     * @var RestoreQuote
     */
    private $restoreQuote;

    /**
     * @var OrderResource
     */
    private $orderResource;

    /**
     * @var OrderFactory
     */
    private $orderFactory;

    /**
     * @var UrlCookie
     */
    private $urlCookie;

    /**
     * @var InvoiceService
     */
    private $invoiceService;

    /**
     * @var Transaction
     */
    private $transaction;
    /**
     * @var DecoderInterface
     */
    private $urlDecoder;
    /**
     * @var ConfigRepository
     */
    private $configRepository;
    /**
     * @var RequestInterface
     */
    private $request;

    /**
     * PaymentAbstract constructor.
     *
     * @param Adapter $apiAdapter
     * @param RestoreQuote $restoreQuote
     * @param OrderResource $orderResource
     * @param OrderFactory $orderFactory
     * @param UrlCookie $urlCookie
     * @param InvoiceService $invoiceService
     * @param Transaction $transaction
     * @param DecoderInterface $urlDecoder
     */
    public function __construct(
        Adapter $apiAdapter,
        RestoreQuote $restoreQuote,
        OrderResource $orderResource,
        OrderFactory $orderFactory,
        UrlCookie $urlCookie,
        InvoiceService $invoiceService,
        Transaction $transaction,
        DecoderInterface $urlDecoder,
        ConfigRepository $configRepository,
        RequestInterface $request
    ) {
        $this->apiAdapter = $apiAdapter;
        $this->restoreQuote = $restoreQuote;
        $this->orderResource = $orderResource;
        $this->orderFactory = $orderFactory;
        $this->urlCookie = $urlCookie;
        $this->invoiceService = $invoiceService;
        $this->transaction = $transaction;
        $this->urlDecoder = $urlDecoder;
        $this->configRepository = $configRepository;
        $this->request = $request;
    }

    /**
     * Get Two Order by Reference
     */
    public function getOrderByReference()
    {
        $this->urlCookie->delete();
        $generalErrorMessage = 'Unable to find the requested order';
        if (!$this->getOrderReference()) {
            throw new LocalizedException(__($generalErrorMessage));
        }

        $order = $this->orderFactory->create();
        $this->orderResource->load(
            $order,
            $this->getOrderReference(),
            'two_order_reference'
        );

        if (!$order->getId() || $order->getPayment()->getMethod() !== Two::CODE || !$order->getTwoOrderId()) {
            throw new LocalizedException(__($generalErrorMessage));
        }

        return $order;
    }

    /**
     * Get order reference from param
     *
     * @return string|null
     */
    public function getOrderReference(): ?string
    {
        $reference = $this->request->getParam('_two_order_reference', null);
        return $reference ? $this->urlDecoder->decode($reference) : $reference;
    }

    /**
     * Get two order from api
     *
     * @param Order $order
     * @return array
     * @throws LocalizedException
     */
    public function getTwoOrderFromApi(Order $order): array
    {
        $response = $this->apiAdapter->execute('/v1/order/' . $order->getTwoOrderId(), [], 'GET');
        $error = $order->getPayment()->getMethodInstance()->getErrorFromResponse($response);
        if ($error) {
            throw new LocalizedException($error);
        }

        return $response;
    }

    /**
     * Send order confirmation request
     *
     * @param Order $order
     * @return mixed
     * @throws LocalizedException
     */
    public function confirmOrder(Order $order)
    {
        $response = $this->apiAdapter->execute("/v1/order/" . $order->getTwoOrderId() . "/confirm");
        $error = $order->getPayment()->getMethodInstance()->getErrorFromResponse($response);
        if ($error) {
            throw new LocalizedException($error);
        }

        return $response;
    }

    /**
     * Send cancel request to api
     *
     * @param Order $order
     * @return bool
     * @throws LocalizedException
     */
    public function cancelTwoOrder(Order $order): bool
    {
        $response = $this->apiAdapter->execute('/v1/order/' . $order->getTwoOrderId() . '/cancel');
        if ($response) {
            $error = $order->getPayment()->getMethodInstance()->getErrorFromResponse($response);
            if ($error) {
                throw new LocalizedException($error);
            }
        }

        return true;
    }

    /**
     * Restore quote
     *
     * @return $this
     */
    public function restoreQuote()
    {
        $this->restoreQuote->execute();
        return $this;
    }

    /**
     * Fail Two order
     *
     * @param Order $order
     * @param $reason
     * @return $this
     * @throws Exception
     */
    public function failOrder(Order $order, $reason)
    {
        $order->setStatus(Two::STATUS_FAILED);
        $order->setState(Order::STATE_CANCELED);
        $this->addOrderComment($order, $reason);
        $order->getPayment()->save();
        $order->save();
        return $this;
    }

    /**
     * Add order comment
     *
     * @param Order $order
     * @param $message
     * @return $this
     */
    public function addOrderComment(Order $order, $message)
    {
        $order->addStatusToHistory($order->getStatus(), $message);
        return $this;
    }

    /**
     * Process Order
     *
     * @param Order $order
     * @return $this
     * @throws LocalizedException
     */
    public function processOrder(Order $order)
    {
        $payment = $order->getPayment();
        if ($this->configRepository->getFulfillOrderType() == 'shipment') {
            $order->setIsInProcess(true);
            $order->setState(Order::STATE_PROCESSING);
            $order->setStatus(Order::STATE_PROCESSING);
            $invoice = $this->invoiceService->prepareInvoice($order);
            $invoice->setRequestedCaptureCase(Invoice::CAPTURE_ONLINE);
            $invoice->register();
            $this->addOrderComment($order, 'Payment has been verified');
            $transactionSave = $this->transaction
                ->addObject(
                    $payment
                )->addObject(
                    $invoice
                )->addObject(
                    $invoice->getOrder()
                );
            $transactionSave->save();
        }
        return $this;
    }
}

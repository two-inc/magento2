<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Observer;

use Exception;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Sales\Api\Data\OrderInterface;
use Magento\Sales\Api\OrderStatusHistoryRepositoryInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Status\HistoryFactory;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Model\Two;
use Two\Gateway\Service\Api\Adapter;

/**
 * After Order Save Observer
 * Fulfill Two paymemt after order saved
 */
class SalesOrderSaveAfter implements ObserverInterface
{
    /**
     * @var ConfigRepository
     */
    private $configRepository;

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
     * SalesOrderSaveAfter constructor.
     *
     * @param ConfigRepository $configRepository
     * @param Adapter $apiAdapter
     * @param HistoryFactory $historyFactory
     * @param OrderStatusHistoryRepositoryInterface $orderStatusHistoryRepository
     */
    public function __construct(
        ConfigRepository $configRepository,
        Adapter $apiAdapter,
        HistoryFactory $historyFactory,
        OrderStatusHistoryRepositoryInterface $orderStatusHistoryRepository
    ) {
        $this->configRepository = $configRepository;
        $this->apiAdapter = $apiAdapter;
        $this->historyFactory = $historyFactory;
        $this->orderStatusHistoryRepository = $orderStatusHistoryRepository;
    }

    /**
     * @param Observer $observer
     * @throws LocalizedException
     */
    public function execute(Observer $observer)
    {
        $order = $observer->getEvent()->getOrder();
        if ($order
            && $order->getPayment()->getMethod() === Two::CODE
            && $order->getTwoOrderId()
        ) {
            if (($this->configRepository->getFulfillTrigger() == 'complete')
                && ($this->configRepository->getFulfillOrderStatus() == $order->getStatus())
            ) {
                if (!$this->isWholeOrderShipped($order)) {
                    $error = __("Two requires whole order to be shipped before it can be fulfilled.");
                    throw new LocalizedException($error);
                }

                $langParams = '?lang=en_US';
                if ($order->getBillingAddress()->getCountryId() == 'NO') {
                    $langParams = '?lang=nb_NO';
                }

                //full fulfilment
                $response = $this->apiAdapter->execute(
                    "/v1/order/" . $order->getTwoOrderId() . "/fulfilled" . $langParams
                );

                foreach ($order->getInvoiceCollection() as $invoice) {
                    $invoice->pay();
                    $invoice->setTransactionId($order->getPayment()->getLastTransId());
                    $invoice->save();
                }

                $this->parseResponse($response, $order);
            }
        }
    }

    /**
     * @param OrderInterface $order
     * @return bool
     */
    private function isWholeOrderShipped(OrderInterface $order): bool
    {
        foreach ($order->getAllVisibleItems() as $orderItem) {
            /** @var Order\Item $orderItem */
            if ($orderItem->getQtyShipped() < $orderItem->getQtyOrdered()) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param array $response
     * @param Order $order
     * @return void
     * @throws Exception
     */
    private function parseResponse(array $response, Order $order): void
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
}

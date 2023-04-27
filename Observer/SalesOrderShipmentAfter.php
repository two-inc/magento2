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
use Magento\Sales\Api\Data\ShipmentInterface;
use Magento\Sales\Api\OrderStatusHistoryRepositoryInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Status\HistoryFactory;
use Two\Gateway\Api\Config\RepositoryInterface as ConfigRepository;
use Two\Gateway\Model\Two;
use Two\Gateway\Service\Api\Adapter;
use Two\Gateway\Service\Order\ComposeShipment;

/**
 * After Order Shipment Save Observer
 * Fulfill Two paymemt after order shipped
 */
class SalesOrderShipmentAfter implements ObserverInterface
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
     * @var ComposeShipment
     */
    private $composeShipment;

    /**
     * SalesOrderShipmentAfter constructor.
     *
     * @param ConfigRepository $configRepository
     * @param Adapter $apiAdapter
     * @param HistoryFactory $historyFactory
     * @param OrderStatusHistoryRepositoryInterface $orderStatusHistoryRepository
     * @param ComposeShipment $composeShipment
     */
    public function __construct(
        ConfigRepository $configRepository,
        Adapter $apiAdapter,
        HistoryFactory $historyFactory,
        OrderStatusHistoryRepositoryInterface $orderStatusHistoryRepository,
        ComposeShipment $composeShipment
    ) {
        $this->configRepository = $configRepository;
        $this->apiAdapter = $apiAdapter;
        $this->historyFactory = $historyFactory;
        $this->orderStatusHistoryRepository = $orderStatusHistoryRepository;
        $this->composeShipment = $composeShipment;
    }

    /**
     * @param Observer $observer
     * @throws LocalizedException
     */
    public function execute(Observer $observer)
    {
        /** @var Order\Shipment $shipment */
        $shipment = $observer->getEvent()->getShipment();
        $order = $shipment->getOrder();
        if ($order
            && $order->getPayment()->getMethod() === Two::CODE
            && $order->getTwoOrderId()
            && ($this->configRepository->getFulfillOrderType() == 'shipment')
        ) {
            if (!$this->isWholeOrderShipped($order)) {
                $response = $this->partialFulfill($shipment);
                $this->parseResponse($response, $order);
                return;
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
     * @param ShipmentInterface $shipment
     * @return array
     * @throws NoSuchEntityException
     * @throws LocalizedException
     */
    private function partialFulfill(ShipmentInterface $shipment): array
    {
        $order = $shipment->getOrder();
        $twoOrderId = $order->getTwoOrderId();

        $payload = $this->composeShipment->execute($shipment, $order);

        return $this->apiAdapter->execute('/v1/order/' . $twoOrderId . '/fulfilled', $payload);
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

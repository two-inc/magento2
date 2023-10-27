<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Controller\Payment;

use Exception;
use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Action\Context;
use Magento\Framework\App\ResponseInterface;
use Magento\Framework\Exception\LocalizedException;
use Two\Gateway\Service\Payment\OrderService;

/**
 * Cancel Payment Controller
 */
class Cancel extends Action
{
    /**
     * @var OrderService
     */
    private $orderService;

    /**
     * Cancel constructor.
     *
     * @param OrderService $orderService
     * @param Context $context
     */
    public function __construct(
        OrderService $orderService,
        Context $context
    ) {
        $this->orderService = $orderService;
        parent::__construct($context);
    }

    /**
     * @return ResponseInterface
     * @throws Exception
     */
    public function execute()
    {
        try {
            $order = $this->orderService->getOrderByReference();
            $this->orderService->cancelTwoOrder($order);
            throw new LocalizedException(__('Your order with Two has been cancelled. The cart will be restored.'));
        } catch (Exception $exception) {
            $this->orderService->restoreQuote();
            if (isset($order)) {
                $this->orderService->failOrder($order, $exception->getMessage());
            }

            $this->messageManager->addErrorMessage($exception->getMessage());
            return $this->getResponse()->setRedirect($this->_url->getUrl('checkout/cart'));
        }
    }
}

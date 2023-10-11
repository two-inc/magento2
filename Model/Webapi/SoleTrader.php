<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Model\Webapi;

use Two\Gateway\Api\Webapi\SoleTraderInterface;
use Two\Gateway\Service\Api\Adapter;

class SoleTrader implements SoleTraderInterface
{
    /**
     * @var Adapter
     */
    private $adapter;

    /**
     * SoleTrader constructor.
     * @param Adapter $adapter
     */
    public function __construct(
        Adapter $adapter
    ) {
        $this->adapter = $adapter;
    }

    /**
     * @inheritDoc
     */
    public function getTokens(string $cartId): array
    {
        $delegationToken = $this->getDelegationToken();
        $autofillToken = $this->getAutofillToken();

        return [['delegation_token' => $delegationToken, 'autofill_token' => $autofillToken]];
    }

    private function getDelegationToken(): string
    {
        $delegateResponse = $this->adapter->execute(
            self::DELEGATION_TOKEN_ENDPOINT,
            ['create_proposal' => true, 'read_current_business' => true]
        );
        if (isset($delegateResponse['token'])) {
            return $delegateResponse['token'];
        } else {
            return '';
        }
    }

    private function getAutofillToken()
    {
        $autofillResponse = $this->adapter->execute(
            self::AUTOFILL_TOKEN_ENDPOINT,
            ['read_current_buyer' => true, 'write_current_buyer' => true]
        );
        if (isset($autofillResponse['token'])) {
            return $autofillResponse['token'];
        } else {
            return '';
        }
    }
}

<?php
/**
 * Copyright © Two.inc All rights reserved.
 * See COPYING.txt for license details.
 */
declare(strict_types=1);

namespace Two\Gateway\Service;

/**
 * Class LineItemsProcessor
 */
class LineItemsProcessor
{

    /**
     * Process line items and change values if needed
     *
     * @param array $items
     * @param float $netAmount
     * @return array
     */
    public function execute(array $items, float $netAmount = 0.00): array
    {
        $items = $this->roundDiscount($items);
        return $this->roundNetAmount($items, $netAmount);
    }

    /**
     * Change discount value to match calculations after rounding
     * net_amount != quantity * unit_price - discount_amount
     *
     * @param array $items
     * @return array
     */
    private function roundDiscount(array $items)
    {
        foreach ($items as $key => $item) {
            if ($item['discount_amount'] != '0.00') {
                $calculatedNetAmount = $item['quantity'] * $item['unit_price'] - $item['discount_amount'];
                //check if calculated net_amount match actual net_amount
                if ($calculatedNetAmount != $item['net_amount']) {
                    $newDiscountAmount = $item['quantity'] * $item['unit_price'] - $item['net_amount'];
                    //check if new calculated discount amount does not exceed limit
                    if (abs($newDiscountAmount - (float)$item['discount_amount']) < ($item['quantity'] * 0.005)) {
                        //change item discount value
                        $items[$key]['discount_amount'] = $this->roundAmt($newDiscountAmount);
                    }
                }
            }
        }
        return $items;
    }

    /**
     * Change first item net_amount if sum of all items net_amount != total net_amount
     *
     * @param array $items
     * @param float $netAmount
     * @return array
     */
    private function roundNetAmount(array $items, float $netAmount = 0.00)
    {
        if ($netAmount) {
            $lineItemsNetAmount = (float)$this->getSum($items, 'net_amount');
            if ($lineItemsNetAmount != $netAmount) {
                $amountDifference = $lineItemsNetAmount - $netAmount;
                if (abs($amountDifference) < count($items) * 0.005) {
                    $items[array_key_last($items)]['net_amount'] -= $amountDifference;
                }
            }
        }
        return $items;
    }

    /**
     * @param $itemsArray
     * @param $columnKey
     * @return string
     */
    public function getSum($itemsArray, $columnKey): string
    {
        return $this->roundAmt(
            array_sum(array_column($itemsArray, $columnKey))
        );
    }

    /**
     * Format price
     *
     * @param mixed $amt
     * @return string
     */
    public function roundAmt($amt): string
    {
        return number_format((float)$amt, 2, '.', '');
    }
}

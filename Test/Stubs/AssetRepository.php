<?php
/**
 * View asset repository stub with a real getUrl() signature. The catch-all
 * autoloader in Test/bootstrap.php produces a method-less class, which PHPUnit
 * cannot configure via ->method(); this gives it something to override.
 */
declare(strict_types=1);

namespace Magento\Framework\View\Asset {
    if (!class_exists(Repository::class, false)) {
        class Repository
        {
            /**
             * @param string $fileId
             * @param array $params
             * @return string
             */
            public function getUrl($fileId, array $params = [])
            {
                return '';
            }
        }
    }
}

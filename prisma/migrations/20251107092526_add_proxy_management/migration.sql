-- CreateTable
CREATE TABLE `proxies` (
    `id` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL,
    `username` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `type` ENUM('HTTP', 'SOCKS5') NOT NULL DEFAULT 'HTTP',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `blockedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `proxies_isActive_idx`(`isActive`),
    INDEX `proxies_blockedUntil_idx`(`blockedUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proxy_usage_logs` (
    `id` VARCHAR(191) NOT NULL,
    `proxyId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('USED', 'SUCCESS', 'CHALLENGE_DETECTED', 'ERROR') NOT NULL,
    `storeId` VARCHAR(191) NULL,
    `url` TEXT NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `proxy_usage_logs_proxyId_idx`(`proxyId`),
    INDEX `proxy_usage_logs_eventType_idx`(`eventType`),
    INDEX `proxy_usage_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `proxy_usage_logs` ADD CONSTRAINT `proxy_usage_logs_proxyId_fkey` FOREIGN KEY (`proxyId`) REFERENCES `proxies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

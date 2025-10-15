-- AlterTable
ALTER TABLE `products` ADD COLUMN `lastAvailableQuantity` INTEGER NULL,
    ADD COLUMN `lastRemainingQuantity` INTEGER NULL,
    ADD COLUMN `lastSoldQuantity` INTEGER NULL,
    ADD COLUMN `lastVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `verificationError` TEXT NULL,
    ADD COLUMN `verificationStatus` ENUM('PENDING', 'VERIFIED', 'SOLD_CONFIRMED', 'OUT_OF_STOCK', 'LISTING_ENDED', 'ERROR') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `products_verificationStatus_idx` ON `products`(`verificationStatus`);

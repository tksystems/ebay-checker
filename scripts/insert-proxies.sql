-- プロキシをproxiesテーブルに登録
-- 6つのプロキシIPアドレスを登録

INSERT INTO `proxies` (`id`, `host`, `port`, `username`, `password`, `type`, `isActive`, `blockedUntil`, `createdAt`, `updatedAt`)
VALUES
  (UUID(), '66.93.6.79', 50100, 'kawamoritakayuki', 'Ri6xam7zgi', 'HTTP', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), '66.93.164.9', 50100, 'kawamoritakayuki', 'Ri6xam7zgi', 'HTTP', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), '193.187.108.54', 50100, 'kawamoritakayuki', 'Ri6xam7zgi', 'HTTP', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), '72.244.46.64', 50100, 'kawamoritakayuki', 'Ri6xam7zgi', 'HTTP', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), '104.219.171.15', 50100, 'kawamoritakayuki', 'Ri6xam7zgi', 'HTTP', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (UUID(), '45.73.181.216', 50100, 'kawamoritakayuki', 'Ri6xam7zgi', 'HTTP', true, NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));


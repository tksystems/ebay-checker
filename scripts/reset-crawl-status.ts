#!/usr/bin/env tsx

/**
 * クロール状態をリセットするスクリプト
 * 本番サーバで実行中のクロールを停止する
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetCrawlStatus(): Promise<void> {
  console.log('🔄 クロール状態をリセットします...\n');

  try {
    // 実行中のクロール状態を取得
    const runningCrawls = await prisma.crawlStatus.findMany({
      where: { isRunning: true },
      include: {
        store: true
      }
    });

    console.log(`📊 実行中のクロール: ${runningCrawls.length}件`);
    
    for (const crawl of runningCrawls) {
      console.log(`  - ストア: ${crawl.store.storeName} (${crawl.serverId || 'unknown'})`);
      console.log(`    開始時刻: ${crawl.startedAt}`);
    }

    if (runningCrawls.length > 0) {
      // すべてのクロール状態を停止
      const result = await prisma.crawlStatus.updateMany({
        where: { isRunning: true },
        data: {
          isRunning: false,
          serverId: null,
          startedAt: null
        }
      });

      console.log(`✅ ${result.count}件のクロール状態をリセットしました`);
    } else {
      console.log('✅ 実行中のクロールはありません');
    }

    // 現在の状態を確認
    const allCrawls = await prisma.crawlStatus.findMany({
      include: {
        store: true
      }
    });

    console.log('\n📊 現在のクロール状態:');
    for (const crawl of allCrawls) {
      console.log(`  - ストア: ${crawl.store.storeName}`);
      console.log(`    実行中: ${crawl.isRunning ? 'はい' : 'いいえ'}`);
      console.log(`    サーバーID: ${crawl.serverId || 'なし'}`);
      console.log(`    開始時刻: ${crawl.startedAt || 'なし'}`);
    }

  } catch (error) {
    console.error('❌ クロール状態のリセット中にエラーが発生しました:', error);
    if (error instanceof Error) {
      console.error(`エラー名: ${error.name}`);
      console.error(`エラーメッセージ: ${error.message}`);
      console.error(`スタックトレース: ${error.stack}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  resetCrawlStatus().catch((error) => {
    console.error('リセットスクリプトの実行に失敗しました:', error);
    process.exit(1);
  });
}

export { resetCrawlStatus };
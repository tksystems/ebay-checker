#!/usr/bin/env tsx

/**
 * ストアのクロール間隔を1分に設定するスクリプト
 */

import { prisma } from '../src/lib/prisma';

async function updateCrawlInterval() {
  console.log('⏰ ストアのクロール間隔を1分に設定します...');

  try {
    // すべてのストアのクロール間隔を60秒（1分）に設定
    const updateResult = await prisma.store.updateMany({
      where: {
        isActive: true
      },
      data: {
        crawlInterval: 60 // 60秒 = 1分
      }
    });

    console.log(`✅ ${updateResult.count}件のストアのクロール間隔を1分に設定しました。`);

    // 設定確認
    const stores = await prisma.store.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        storeName: true,
        crawlInterval: true,
        lastCrawledAt: true
      }
    });

    console.log('\n📋 ストア設定確認:');
    stores.forEach(store => {
      console.log(`   ${store.storeName}: ${store.crawlInterval}秒間隔`);
      console.log(`     最終クロール: ${store.lastCrawledAt ? store.lastCrawledAt.toLocaleString('ja-JP') : '未実行'}`);
    });

    console.log('\n🎉 設定完了！');
    console.log('💡 監視スクリプトを実行すると、1分間隔でクローリングが実行されます。');

  } catch (error) {
    console.error('❌ 設定中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  updateCrawlInterval().catch(error => {
    console.error('❌ スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

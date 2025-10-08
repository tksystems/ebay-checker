#!/usr/bin/env tsx

/**
 * eBayクローラーのテストスクリプト
 * 単発でストアをクローリングしてテストする
 */

import { ebayCrawlerService } from '../src/services/ebayCrawlerService';

async function testCrawler(storeName?: string): Promise<void> {
  try {
    console.log('🧪 eBayクローラーのテストを開始します...\n');

    let storeId: string;

    if (storeName) {
      // 指定されたストア名で既存ストアを検索
      console.log(`🔍 ストア「${storeName}」を検索中...`);
      const stores = await ebayCrawlerService.getStores();
      const existingStore = stores.find(store => store.storeName === storeName);
      
      if (existingStore) {
        storeId = existingStore.id;
        console.log(`✅ 既存ストアを使用します: ${storeName} (${storeId})\n`);
      } else {
        console.log(`📝 ストア「${storeName}」が見つからないため、新規作成します...`);
        storeId = await ebayCrawlerService.addStore(storeName);
        console.log(`✅ ストアを追加しました: ${storeId}\n`);
      }
    } else {
      // 既存ストア一覧を表示して選択
      console.log('📋 既存ストア一覧:');
      const stores = await ebayCrawlerService.getStores();
      
      if (stores.length === 0) {
        console.log('📝 既存ストアがないため、デフォルトストアを作成します...');
        storeId = await ebayCrawlerService.addStore('fsoushop');
        console.log(`✅ ストアを追加しました: ${storeId}\n`);
      } else {
        stores.forEach((store, index) => {
          console.log(`  ${index + 1}. ${store.storeName} (${store.id})`);
          console.log(`     商品数: ${store.productCount}件`);
          console.log(`     最終クロール: ${store.lastCrawledAt || '未実行'}`);
        });
        console.log('');
        
        // 最初のストアを使用
        storeId = stores[0].id;
        console.log(`✅ 最初のストアを使用します: ${stores[0].storeName} (${storeId})\n`);
      }
    }

    // クローリングを実行
    console.log('🔍 クローリングを実行中...');
    const result = await ebayCrawlerService.crawlStore(storeId);

    if (result.success) {
      console.log('✅ クローリングが完了しました！');
      console.log(`   商品数: ${result.productsFound}件`);
      console.log(`   新商品: ${result.productsNew}件`);
      console.log(`   更新: ${result.productsUpdated}件`);
      console.log(`   売れた: ${result.productsSold}件`);
      console.log(`   実行時間: ${result.duration}ms\n`);

      // 商品一覧を表示
      console.log('📦 取得した商品一覧:');
      const products = await ebayCrawlerService.getStoreProducts(storeId, 10);
      products.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title}`);
        console.log(`     価格: $${product.price}`);
        console.log(`     状態: ${product.status}`);
        console.log(`     最終確認: ${product.lastSeenAt.toISOString()}`);
        if (product.soldAt) {
          console.log(`     売れた時刻: ${product.soldAt.toISOString()}`);
        }
        console.log('');
      });

    } else {
      console.error('❌ クローリングに失敗しました:');
      console.error(`   エラー: ${result.errorMessage}`);
      console.error(`   実行時間: ${result.duration}ms`);
    }

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
  }
}

// メイン実行
async function main(): Promise<void> {
  // コマンドライン引数を取得
  const args = process.argv.slice(2);
  const storeName = args[0]; // 最初の引数をストア名として使用
  
  if (storeName) {
    console.log(`指定されたストア名: ${storeName}`);
  }
  
  await testCrawler(storeName);
  process.exit(0);
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main().catch((error) => {
    console.error('テストスクリプトの実行に失敗しました:', error);
    process.exit(1);
  });
}

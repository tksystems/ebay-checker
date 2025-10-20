#!/usr/bin/env tsx

import { EbayCrawlerService } from '../src/services/ebayCrawlerService';

async function testOptimizedCrawler() {
  console.log('🚀 最適化されたクローラーのテストを開始します...');
  
  const crawler = new EbayCrawlerService();
  
  try {
    // テスト用のストアを追加
    const storeId = await crawler.addStore('test-store-optimized');
    console.log(`✅ テストストアを作成しました: ${storeId}`);
    
    // クロールを実行
    console.log('🔄 クロールを開始します...');
    const result = await crawler.crawlStore(storeId);
    
    console.log('📊 クロール結果:');
    console.log(`- 成功: ${result.success}`);
    console.log(`- 発見商品数: ${result.productsFound}`);
    console.log(`- 新規商品数: ${result.productsNew}`);
    console.log(`- 更新商品数: ${result.productsUpdated}`);
    console.log(`- 売却商品数: ${result.productsSold}`);
    console.log(`- 実行時間: ${result.duration}ms`);
    
    if (result.errorMessage) {
      console.error(`❌ エラー: ${result.errorMessage}`);
    }
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
  }
}

// テスト実行
testOptimizedCrawler().catch(console.error);

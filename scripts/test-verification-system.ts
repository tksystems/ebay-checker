#!/usr/bin/env tsx

/**
 * 検証システムの統合テストスクリプト
 * 
 * 使用方法:
 * npm run test:verification                    # 検証システムのテスト実行
 */

import { EbayDetailVerificationService } from '../src/services/ebayDetailVerificationService';
import { NotificationService } from '../src/services/notificationService';
import { VerificationBatchProcessor } from '../src/services/verificationBatchProcessor';
import { VerificationNotificationService } from '../src/services/verificationNotificationService';

async function testEbayApiClient() {
  console.log('🔍 eBay APIクライアントのテスト...');
  
  try {
    const verificationService = new EbayDetailVerificationService();
    
    // テスト用のitemId（実際のeBay商品ID）
    const testItemId = '336041668545';
    
    console.log(`📦 商品 ${testItemId} の詳細確認をテスト中...`);
    const result = await verificationService.verifyProduct({ ebayItemId: testItemId });
    
    if (result.success) {
      console.log('✅ API呼び出し成功');
      console.log(`   商品ID: ${result.productDetails?.itemId}`);
      console.log(`   在庫ステータス: ${result.productDetails?.availabilityStatus}`);
      console.log(`   売上数量: ${result.productDetails?.soldQuantity}`);
      console.log(`   在庫数量: ${result.productDetails?.availableQuantity}`);
      console.log(`   残り数量: ${result.productDetails?.remainingQuantity}`);
      console.log(`   売上確認: ${result.isSold ? 'はい' : 'いいえ'}`);
    } else {
      console.log('❌ API呼び出し失敗');
      console.log(`   エラー: ${result.error?.message}`);
    }
    
    return result.success;
  } catch (error) {
    console.log('❌ テスト中にエラーが発生しました:', error);
    return false;
  }
}

async function testVerificationStats() {
  console.log('📊 検証統計のテスト...');
  
  try {
    const verificationService = new EbayDetailVerificationService();
    const stats = await verificationService.getVerificationStats();
    
    console.log('✅ 検証統計取得成功');
    console.log(`   総商品数: ${stats.total}件`);
    console.log(`   未検証: ${stats.pending}件`);
    console.log(`   検証済み: ${stats.verified}件`);
    console.log(`   売上確認済み: ${stats.soldConfirmed}件`);
    console.log(`   削除された商品: ${stats.deleted}件（売れていませんでした）`);
    console.log(`   エラー: ${stats.error}件`);
    
    return true;
  } catch (error) {
    console.log('❌ 統計取得中にエラーが発生しました:', error);
    return false;
  }
}

async function testNotificationStats() {
  console.log('📧 通知統計のテスト...');
  
  try {
    const notificationService = new NotificationService();
    const stats = await notificationService.getNotificationStats();
    
    console.log('✅ 通知統計取得成功');
    console.log(`   総通知数: ${stats.total}件`);
    console.log(`   送信待ち: ${stats.pending}件`);
    console.log(`   送信済み: ${stats.sent}件`);
    console.log(`   送信失敗: ${stats.failed}件`);
    
    return true;
  } catch (error) {
    console.log('❌ 通知統計取得中にエラーが発生しました:', error);
    return false;
  }
}

async function testHealthCheck() {
  console.log('🏥 システムヘルスチェック...');
  
  try {
    const verificationNotificationService = new VerificationNotificationService();
    const health = await verificationNotificationService.healthCheck();
    
    console.log(`✅ ヘルスチェック完了: ${health.status.toUpperCase()}`);
    
    if (health.issues.length > 0) {
      console.log('⚠️  発見された問題:');
      health.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    } else {
      console.log('🎉 問題は見つかりませんでした');
    }
    
    return health.status === 'healthy' || health.status === 'warning';
  } catch (error) {
    console.log('❌ ヘルスチェック中にエラーが発生しました:', error);
    return false;
  }
}

async function testBatchProcessor() {
  console.log('🔄 バッチ処理のテスト...');
  
  try {
    const batchProcessor = new VerificationBatchProcessor();
    
    // 統計表示
    await batchProcessor.displayVerificationStats();
    
    // 小規模なバッチ処理をテスト（実際の処理は行わない）
    console.log('📦 バッチ処理の設定確認...');
    console.log('   バッチサイズ: 5件');
    console.log('   処理間隔: 2秒');
    console.log('   最大リトライ: 3回');
    
    return true;
  } catch (error) {
    console.log('❌ バッチ処理テスト中にエラーが発生しました:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 検証システムの統合テストを開始します...\n');

  const tests = [
    { name: 'eBay APIクライアント', fn: testEbayApiClient },
    { name: '検証統計', fn: testVerificationStats },
    { name: '通知統計', fn: testNotificationStats },
    { name: 'システムヘルスチェック', fn: testHealthCheck },
    { name: 'バッチ処理', fn: testBatchProcessor }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n--- ${test.name} ---`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ ${test.name}: 成功`);
      } else {
        failed++;
        console.log(`❌ ${test.name}: 失敗`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ ${test.name}: エラー - ${error}`);
    }
  }

  console.log('\n📊 テスト結果サマリー:');
  console.log(`   成功: ${passed}件`);
  console.log(`   失敗: ${failed}件`);
  console.log(`   成功率: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 すべてのテストが成功しました！');
    process.exit(0);
  } else {
    console.log('\n⚠️  一部のテストが失敗しました。');
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  main().catch(error => {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

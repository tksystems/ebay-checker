#!/usr/bin/env tsx

/**
 * 商品検証バッチ処理スクリプト
 * 
 * 使用方法:
 * npm run verify:products                    # 最新の売れた商品の検証処理
 * npm run verify:products -- --retry        # エラー商品の再処理
 * npm run verify:products -- --stats        # 検証統計の表示
 * npm run verify:products -- --cleanup      # 古い検証データのクリーンアップ
 */

import { VerificationBatchProcessor } from '../src/services/verificationBatchProcessor';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'process';

  const processor = new VerificationBatchProcessor();

  try {
    switch (command) {
      case 'process':
        console.log('🚀 最新の売れた商品の検証処理を開始します...');
        await processor.processPendingVerifications({
          batchSize: 10,
          delayBetweenBatches: 2000
        });
        break;

      case 'retry':
        console.log('🔄 エラー商品の再処理を開始します...');
        await processor.retryFailedVerifications({
          batchSize: 5
        });
        break;

      case 'stats':
        console.log('📊 検証統計を表示します...');
        await processor.displayVerificationStats();
        break;

      case 'cleanup':
        const dryRun = !args.includes('--force');
        console.log(`🧹 古い検証データのクリーンアップを開始します... (${dryRun ? 'ドライラン' : '実際の削除'})`);
        await processor.cleanupOldVerifications({
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
          dryRun
        });
        break;

      default:
        console.log('❌ 不明なコマンド:', command);
        console.log('使用可能なコマンド:');
        console.log('  process  - 最新の売れた商品の検証処理');
        console.log('  retry    - エラー商品の再処理');
        console.log('  stats    - 検証統計の表示');
        console.log('  cleanup  - 古い検証データのクリーンアップ');
        console.log('');
        console.log('オプション:');
        console.log('  --force  - クリーンアップ時に実際の削除を実行');
        process.exit(1);
    }

    console.log('✅ 処理が完了しました。');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  main();
}

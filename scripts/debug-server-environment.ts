#!/usr/bin/env tsx

/**
 * 本番サーバ環境のデバッグスクリプト
 * サーバ環境での詳細な情報を取得して問題を特定する
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugServerEnvironment(): Promise<void> {
  console.log('🔍 本番サーバ環境のデバッグを開始します...\n');

  try {
    // 1. システム情報
    console.log('📊 システム情報:');
    console.log(`  Node.js バージョン: ${process.version}`);
    console.log(`  プラットフォーム: ${process.platform}`);
    console.log(`  アーキテクチャ: ${process.arch}`);
    console.log(`  CPU数: ${require('os').cpus().length}`);
    console.log(`  総メモリ: ${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)}GB`);
    console.log(`  空きメモリ: ${Math.round(require('os').freemem() / 1024 / 1024 / 1024)}GB`);
    console.log(`  稼働時間: ${Math.round(require('os').uptime() / 3600)}時間`);
    console.log('');

    // 2. 環境変数
    console.log('🌍 環境変数:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  SERVER_ID: ${process.env.SERVER_ID}`);
    console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '設定済み' : '未設定'}`);
    console.log('');

    // 3. メモリ使用量
    const memoryUsage = process.memoryUsage();
    console.log('💾 現在のメモリ使用量:');
    console.log(`  RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
    console.log(`  Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`  External: ${Math.round(memoryUsage.external / 1024 / 1024)}MB`);
    console.log('');

    // 4. Playwrightの可用性チェック
    console.log('🎭 Playwright可用性チェック:');
    try {
      const playwrightExtra = require("playwright-extra");
      const stealthPlugin = require("puppeteer-extra-plugin-stealth");
      console.log('  ✅ playwright-extra: 利用可能');
      console.log('  ✅ puppeteer-extra-plugin-stealth: 利用可能');
      
      const chromium = playwrightExtra.chromium;
      const StealthPlugin = stealthPlugin.default || stealthPlugin;
      
      if (chromium && StealthPlugin) {
        console.log('  ✅ Chromium: 利用可能');
        console.log('  ✅ Stealth Plugin: 利用可能');
      } else {
        console.log('  ❌ Chromium または Stealth Plugin: 利用不可');
      }
    } catch (error) {
      console.log('  ❌ Playwright関連パッケージ: 利用不可');
      console.log(`  エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.log('');

    // 5. データベース接続テスト
    console.log('🗄️  データベース接続テスト:');
    try {
      await prisma.$connect();
      console.log('  ✅ データベース接続: 成功');
      
      // ストア情報を取得
      const stores = await prisma.store.findMany({
        where: { isActive: true },
        include: {
          crawlStatus: true,
          _count: {
            select: { products: true }
          }
        }
      });
      
      console.log(`  📊 アクティブストア数: ${stores.length}件`);
      for (const store of stores) {
        console.log(`    - ${store.storeName}: 商品数=${store._count.products}件, クロール状態=${store.crawlStatus?.isRunning ? '実行中' : '停止中'}`);
      }
    } catch (error) {
      console.log('  ❌ データベース接続: 失敗');
      console.log(`  エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.log('');

    // 6. ブラウザ起動テスト
    console.log('🌐 ブラウザ起動テスト:');
    try {
      const playwrightExtra = require("playwright-extra");
      const stealthPlugin = require("puppeteer-extra-plugin-stealth");
      
      const chromium = playwrightExtra.chromium;
      const StealthPlugin = stealthPlugin.default || stealthPlugin;
      
      if (chromium && StealthPlugin) {
        chromium.use(StealthPlugin());
        
        console.log('  🚀 ブラウザ起動中...');
        const browserStartTime = Date.now();
        const memoryBefore = process.memoryUsage();
        
        const browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--memory-pressure-off',
            '--max_old_space_size=4096'
          ]
        });
        
        const browserLaunchTime = Date.now() - browserStartTime;
        const memoryAfter = process.memoryUsage();
        
        console.log(`  ✅ ブラウザ起動: 成功 (${browserLaunchTime}ms)`);
        console.log(`  📊 メモリ増加: RSS=${Math.round((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024)}MB, Heap=${Math.round((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024)}MB`);
        
        // ページ作成テスト
        console.log('  📄 ページ作成テスト...');
        const page = await browser.newPage();
        console.log('  ✅ ページ作成: 成功');
        
        // 簡単なページ読み込みテスト
        console.log('  🌐 ページ読み込みテスト...');
        await page.goto('https://www.ebay.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('  ✅ ページ読み込み: 成功');
        
        // ブラウザ終了
        console.log('  🔒 ブラウザ終了中...');
        await browser.close();
        console.log('  ✅ ブラウザ終了: 成功');
        
      } else {
        console.log('  ❌ Playwrightが利用できません');
      }
    } catch (error) {
      console.log('  ❌ ブラウザ起動テスト: 失敗');
      console.log(`  エラー名: ${error instanceof Error ? error.name : 'Unknown'}`);
      console.log(`  エラーメッセージ: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.stack) {
        console.log(`  スタックトレース: ${error.stack}`);
      }
    }
    console.log('');

    // 7. 最終メモリ使用量
    const finalMemoryUsage = process.memoryUsage();
    console.log('💾 最終メモリ使用量:');
    console.log(`  RSS: ${Math.round(finalMemoryUsage.rss / 1024 / 1024)}MB`);
    console.log(`  Heap Used: ${Math.round(finalMemoryUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap Total: ${Math.round(finalMemoryUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`  External: ${Math.round(finalMemoryUsage.external / 1024 / 1024)}MB`);
    console.log('');

    console.log('✅ デバッグ完了');

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error);
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
  debugServerEnvironment().catch((error) => {
    console.error('デバッグスクリプトの実行に失敗しました:', error);
    process.exit(1);
  });
}

export { debugServerEnvironment };

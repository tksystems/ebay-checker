#!/usr/bin/env tsx

/**
 * eBayアクセス問題の詳細診断スクリプト
 * 真の原因を特定するための包括的なテスト
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// サーバーサイドでのみPlaywrightをインポート
let chromium: typeof import('playwright-extra').chromium | undefined;
let StealthPlugin: any;

if (typeof window === 'undefined' && typeof process !== 'undefined') {
  try {
    const playwrightExtra = require("playwright-extra");
    const stealthPlugin = require("puppeteer-extra-plugin-stealth");
    
    chromium = playwrightExtra.chromium;
    StealthPlugin = stealthPlugin.default || stealthPlugin;
    
    if (chromium && StealthPlugin) {
      chromium.use(StealthPlugin());
    }
  } catch (error) {
    console.warn('Playwright dependencies not available:', error);
  }
}

async function debugEbayAccess(): Promise<void> {
  console.log('🔍 eBayアクセス問題の詳細診断を開始します...\n');

  try {
    if (!chromium) {
      console.error('❌ Playwrightが利用できません');
      return;
    }

    // 1. 基本的なネットワーク接続テスト
    console.log('🌐 基本的なネットワーク接続テスト:');
    try {
      const https = require('https');
      const url = require('url');
      
      const testUrl = 'https://www.ebay.com';
      const parsedUrl = url.parse(testUrl);
      
      const request = https.request({
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }, (response: any) => {
        console.log(`  ✅ HTTP接続: ステータス ${response.statusCode}`);
        console.log(`  📊 レスポンスヘッダー:`, {
          'content-type': response.headers['content-type'],
          'content-length': response.headers['content-length'],
          'server': response.headers['server']
        });
      });
      
      request.on('error', (error: any) => {
        console.log(`  ❌ HTTP接続エラー: ${error.message}`);
      });
      
      request.setTimeout(10000, () => {
        console.log('  ⏰ HTTP接続タイムアウト');
        request.destroy();
      });
      
      request.end();
      
      // 結果を待つ
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`  ❌ ネットワークテストエラー: ${error}`);
    }
    console.log('');

    // 2. ブラウザでのeBayアクセステスト
    console.log('🌐 ブラウザでのeBayアクセステスト:');
    let browser: any = null;
    
    try {
      console.log('  🚀 ブラウザ起動中...');
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--memory-pressure-off',
          '--max_old_space_size=4096',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
      });
      
      console.log('  ✅ ブラウザ起動完了');
      
      const page = await browser.newPage();
      
      // リクエスト/レスポンスの監視
      page.on('request', (request: any) => {
        console.log(`  📤 リクエスト: ${request.method()} ${request.url()}`);
      });
      
      page.on('response', (response: any) => {
        console.log(`  📥 レスポンス: ${response.status()} ${response.url()}`);
      });
      
      page.on('console', (msg: any) => {
        console.log(`  🖥️  ブラウザコンソール: ${msg.text()}`);
      });
      
      // eBayのトップページにアクセス
      console.log('  🌐 eBayトップページにアクセス中...');
      const startTime = Date.now();
      
      try {
        await page.goto('https://www.ebay.com', { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        
        const loadTime = Date.now() - startTime;
        console.log(`  ✅ eBayトップページ読み込み完了: ${loadTime}ms`);
        
        // ページタイトルを取得
        const title = await page.title();
        console.log(`  📄 ページタイトル: ${title}`);
        
        // 基本的な要素の存在確認
        const bodyExists = await page.$('body') !== null;
        console.log(`  📄 body要素存在: ${bodyExists}`);
        
        // 検索ボックスの存在確認
        const searchBox = await page.$('input[type="text"], input[placeholder*="search"], input[name*="search"]');
        console.log(`  🔍 検索ボックス存在: ${searchBox !== null}`);
        
      } catch (gotoError) {
        console.log(`  ❌ eBayトップページアクセス失敗: ${gotoError}`);
        if (gotoError instanceof Error) {
          console.log(`  📝 エラー名: ${gotoError.name}`);
          console.log(`  📝 エラーメッセージ: ${gotoError.message}`);
        }
      }
      
      // ストアページにアクセス
      console.log('  🏪 ストアページにアクセス中...');
      try {
        const storeUrl = 'https://www.ebay.com/sch/i.html?_dkr=1&iconV2Request=true&_blrs=recall_filtering&_ssn=f_sou_shop&store_cat=0&store_name=fsoushop&_ipg=240&_sop=15&_pgn=1';
        
        await page.goto(storeUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        
        console.log(`  ✅ ストアページ読み込み完了`);
        
        // 商品要素の存在確認
        const productElements = await page.$$('.s-card__title, .s-item__title');
        console.log(`  📦 商品要素数: ${productElements.length}件`);
        
        if (productElements.length > 0) {
          // 最初の商品のタイトルを取得
          const firstProduct = await page.evaluate(() => {
            const element = document.querySelector('.s-card__title, .s-item__title');
            return element ? element.textContent?.trim() : null;
          });
          console.log(`  📦 最初の商品: ${firstProduct}`);
        }
        
        // ページのHTMLサイズを確認
        const htmlContent = await page.content();
        console.log(`  📊 HTMLサイズ: ${Math.round(htmlContent.length / 1024)}KB`);
        
        // JavaScriptエラーの確認
        const jsErrors: string[] = [];
        page.on('pageerror', (error: any) => {
          jsErrors.push(error.message);
        });
        
        if (jsErrors.length > 0) {
          console.log(`  ⚠️  JavaScriptエラー: ${jsErrors.length}件`);
          jsErrors.slice(0, 3).forEach((error, index) => {
            console.log(`    ${index + 1}. ${error}`);
          });
        } else {
          console.log(`  ✅ JavaScriptエラーなし`);
        }
        
      } catch (storeError) {
        console.log(`  ❌ ストアページアクセス失敗: ${storeError}`);
        if (storeError instanceof Error) {
          console.log(`  📝 エラー名: ${storeError.name}`);
          console.log(`  📝 エラーメッセージ: ${storeError.message}`);
        }
      }
      
    } catch (browserError) {
      console.log(`  ❌ ブラウザテストエラー: ${browserError}`);
      if (browserError instanceof Error) {
        console.log(`  📝 エラー名: ${browserError.name}`);
        console.log(`  📝 エラーメッセージ: ${browserError.message}`);
        console.log(`  📝 スタックトレース: ${browserError.stack}`);
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('  🔒 ブラウザ終了完了');
        } catch (closeError) {
          console.log(`  ❌ ブラウザ終了エラー: ${closeError}`);
        }
      }
    }
    console.log('');

    // 3. システムリソースの詳細確認
    console.log('💾 システムリソースの詳細確認:');
    const memoryUsage = process.memoryUsage();
    console.log(`  RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
    console.log(`  Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`  External: ${Math.round(memoryUsage.external / 1024 / 1024)}MB`);
    
    // システム情報
    const os = require('os');
    console.log(`  総メモリ: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
    console.log(`  空きメモリ: ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`);
    console.log(`  CPU数: ${os.cpus().length}`);
    console.log(`  稼働時間: ${Math.round(os.uptime() / 3600)}時間`);
    console.log('');

    // 4. 環境変数とネットワーク設定
    console.log('🌍 環境変数とネットワーク設定:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`  HTTP_PROXY: ${process.env.HTTP_PROXY || 'undefined'}`);
    console.log(`  HTTPS_PROXY: ${process.env.HTTPS_PROXY || 'undefined'}`);
    console.log(`  NO_PROXY: ${process.env.NO_PROXY || 'undefined'}`);
    console.log(`  USER_AGENT: ${process.env.USER_AGENT || 'undefined'}`);
    console.log('');

    console.log('✅ 診断完了');

  } catch (error) {
    console.error('❌ 診断中にエラーが発生しました:', error);
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
  debugEbayAccess().catch((error) => {
    console.error('診断スクリプトの実行に失敗しました:', error);
    process.exit(1);
  });
}

export { debugEbayAccess };

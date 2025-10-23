#!/usr/bin/env tsx

/**
 * ストアページアクセス問題の詳細診断スクリプト
 * ストアページでのみ発生する問題を特定する
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

async function debugStoreAccess(): Promise<void> {
  console.log('🔍 ストアページアクセス問題の詳細診断を開始します...\n');

  try {
    if (!chromium) {
      console.error('❌ Playwrightが利用できません');
      return;
    }

    let browser: any = null;
    
    try {
      console.log('🚀 ブラウザ起動中...');
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
      
      console.log('✅ ブラウザ起動完了');
      
      const page = await browser.newPage();
      
      // 詳細なイベント監視
      page.on('request', (request: any) => {
        console.log(`📤 リクエスト: ${request.method()} ${request.url()}`);
      });
      
      page.on('response', (response: any) => {
        console.log(`📥 レスポンス: ${response.status()} ${response.url()}`);
      });
      
      page.on('console', (msg: any) => {
        console.log(`🖥️  ブラウザコンソール: ${msg.text()}`);
      });
      
      page.on('pageerror', (error: any) => {
        console.log(`❌ ページエラー: ${error.message}`);
      });
      
      // ストアページにアクセス
      const storeUrl = 'https://www.ebay.com/sch/i.html?_dkr=1&iconV2Request=true&_blrs=recall_filtering&_ssn=f_sou_shop&store_cat=0&store_name=fsoushop&_ipg=240&_sop=15&_pgn=1';
      
      console.log(`🌐 ストアページにアクセス中: ${storeUrl}`);
      console.log(`🕐 開始時刻: ${new Date().toISOString()}`);
      
      const startTime = Date.now();
      
      try {
        await page.goto(storeUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        
        const loadTime = Date.now() - startTime;
        console.log(`✅ ストアページ読み込み完了: ${loadTime}ms`);
        
        // ページタイトルを取得
        const title = await page.title();
        console.log(`📄 ページタイトル: ${title}`);
        
        // 基本的な要素の存在確認
        const bodyExists = await page.$('body') !== null;
        console.log(`📄 body要素存在: ${bodyExists}`);
        
        // 商品要素の存在確認
        console.log(`🔍 商品要素の存在確認中...`);
        const productElements = await page.$$('.s-card__title, .s-item__title');
        console.log(`📦 商品要素数: ${productElements.length}件`);
        
        if (productElements.length > 0) {
          console.log(`✅ 商品要素が見つかりました`);
          
          // 最初の商品のタイトルを取得
          const firstProduct = await page.evaluate(() => {
            const element = document.querySelector('.s-card__title, .s-item__title');
            return element ? element.textContent?.trim() : null;
          });
          console.log(`📦 最初の商品: ${firstProduct}`);
          
          // 商品要素の詳細確認
          console.log(`🔍 商品要素の詳細確認中...`);
          const productDetails = await page.evaluate(() => {
            const elements = document.querySelectorAll('.s-card__title, .s-item__title');
            const details = [];
            
            for (let i = 0; i < Math.min(5, elements.length); i++) {
              const element = elements[i];
              const title = element.textContent?.trim();
              const link = element.closest('a')?.href;
              details.push({
                index: i,
                title: title,
                hasLink: !!link,
                link: link
              });
            }
            
            return details;
          });
          
          console.log(`📦 商品詳細 (最初の5件):`);
          productDetails.forEach((detail: any, index: number) => {
            console.log(`  ${index + 1}. タイトル: ${detail.title}`);
            console.log(`     リンク: ${detail.hasLink ? 'あり' : 'なし'}`);
            if (detail.link) {
              console.log(`     URL: ${detail.link}`);
            }
          });
          
        } else {
          console.log(`⚠️  商品要素が見つかりません`);
          
          // ページの内容を確認
          const pageContent = await page.content();
          console.log(`📊 ページサイズ: ${Math.round(pageContent.length / 1024)}KB`);
          
          // エラーメッセージの確認
          const errorElements = await page.$$('.error, .alert, .warning, [class*="error"], [class*="alert"]');
          if (errorElements.length > 0) {
            console.log(`⚠️  エラー要素が見つかりました: ${errorElements.length}件`);
            
            for (let i = 0; i < Math.min(3, errorElements.length); i++) {
              const errorText = await errorElements[i].textContent();
              console.log(`  ${i + 1}. ${errorText}`);
            }
          }
          
          // ページのHTMLの一部を確認
          const htmlSnippet = pageContent.substring(0, 1000);
          console.log(`📄 HTMLの一部: ${htmlSnippet}`);
        }
        
        // ページのHTMLサイズを確認
        const htmlContent = await page.content();
        console.log(`📊 HTMLサイズ: ${Math.round(htmlContent.length / 1024)}KB`);
        
        // JavaScriptエラーの確認
        const jsErrors: string[] = [];
        page.on('pageerror', (error: any) => {
          jsErrors.push(error.message);
        });
        
        if (jsErrors.length > 0) {
          console.log(`⚠️  JavaScriptエラー: ${jsErrors.length}件`);
          jsErrors.slice(0, 3).forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
          });
        } else {
          console.log(`✅ JavaScriptエラーなし`);
        }
        
      } catch (storeError) {
        console.log(`❌ ストアページアクセス失敗: ${storeError}`);
        if (storeError instanceof Error) {
          console.log(`📝 エラー名: ${storeError.name}`);
          console.log(`📝 エラーメッセージ: ${storeError.message}`);
          console.log(`📝 スタックトレース: ${storeError.stack}`);
        }
      }
      
    } catch (browserError) {
      console.log(`❌ ブラウザテストエラー: ${browserError}`);
      if (browserError instanceof Error) {
        console.log(`📝 エラー名: ${browserError.name}`);
        console.log(`📝 エラーメッセージ: ${browserError.message}`);
        console.log(`📝 スタックトレース: ${browserError.stack}`);
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('🔒 ブラウザ終了完了');
        } catch (closeError) {
          console.log(`❌ ブラウザ終了エラー: ${closeError}`);
        }
      }
    }
    
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
  debugStoreAccess().catch((error) => {
    console.error('診断スクリプトの実行に失敗しました:', error);
    process.exit(1);
  });
}

export { debugStoreAccess };

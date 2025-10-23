import { prisma } from "@/lib/prisma";
import { ProductStatus, CrawlLogStatus } from "@prisma/client";

// サーバーサイドでのみPlaywrightをインポート
let chromium: typeof import('playwright-extra').chromium | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StealthPlugin: any;

// サーバーサイドでのみ実行されることを保証
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const playwrightExtra = require("playwright-extra");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const stealthPlugin = require("puppeteer-extra-plugin-stealth");
    
    chromium = playwrightExtra.chromium;
    StealthPlugin = stealthPlugin.default || stealthPlugin;
    
    // Stealth Pluginを適用
    if (chromium && StealthPlugin) {
      chromium.use(StealthPlugin());
    }
  } catch (error) {
    console.warn('Playwright dependencies not available:', error);
  }
}

export interface EbayProduct {
  title: string;
  price: string;
  url: string;
  itemId: string;
  condition?: string;
  imageUrl?: string;
  quantity?: number;
}

export interface CrawlResult {
  success: boolean;
  productsFound: number;
  productsNew: number;
  productsUpdated: number;
  productsSold: number;
  errorMessage?: string;
  duration: number;
}

export class EbayCrawlerService {
  private readonly DEFAULT_CRAWL_INTERVAL = 1000; // 1秒
  private readonly MAX_RETRIES = 3;
  private readonly PAGE_TIMEOUT = 60000;
  private readonly ELEMENT_TIMEOUT = 15000;

  /**
   * ストアの全商品をクローリング
   */
  async crawlStore(storeId: string): Promise<CrawlResult> {
    // サーバーサイドでのみ実行可能
    if (typeof window !== 'undefined') {
      throw new Error('Crawling can only be performed on the server side');
    }

    // Playwrightが利用可能かチェック
    if (!chromium) {
      throw new Error('Playwright is not available. This service should only be used in CLI scripts.');
    }

    const startTime = Date.now();
    
    try {
      // ストア情報を取得
      const store = await prisma.store.findUnique({
        where: { id: storeId }
      });

      if (!store) {
        throw new Error(`Store not found: ${storeId}`);
      }

      if (!store.isActive) {
        throw new Error(`Store is inactive: ${store.storeName}`);
      }

      // クロールログを作成
      const crawlLog = await prisma.crawlLog.create({
        data: {
          storeId: store.id,
          status: CrawlLogStatus.SUCCESS,
          startedAt: new Date(),
        }
      });

      try {
        // クロール状態を更新
        await this.updateCrawlStatus(store.id, true);

        // 全ページの商品を取得
        const products = await this.getAllProducts(store.storeName);
        
        // 商品情報をデータベースに保存・更新
        const result = await this.processProducts(store.id, products);
        
        // クロールログを更新
        await prisma.crawlLog.update({
          where: { id: crawlLog.id },
          data: {
            status: CrawlLogStatus.SUCCESS,
            productsFound: result.productsFound,
            productsNew: result.productsNew,
            productsUpdated: result.productsUpdated,
            productsSold: result.productsSold,
            completedAt: new Date(),
          }
        });

        // ストアの最終クロール時刻を更新
        await prisma.store.update({
          where: { id: store.id },
          data: { lastCrawledAt: new Date() }
        });

        return {
          success: true,
          productsFound: result.productsFound,
          productsNew: result.productsNew,
          productsUpdated: result.productsUpdated,
          productsSold: result.productsSold,
          duration: Date.now() - startTime
        };

      } catch (error) {
        // エラーログを更新
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const truncatedErrorMessage = errorMessage.length > 500 ? errorMessage.substring(0, 500) + '...' : errorMessage;
        
        await prisma.crawlLog.update({
          where: { id: crawlLog.id },
          data: {
            status: CrawlLogStatus.FAILED,
            errorMessage: truncatedErrorMessage,
            completedAt: new Date(),
          }
        });

        throw error;
      } finally {
        // クロール状態を更新
        await this.updateCrawlStatus(store.id, false);
      }

    } catch (error) {
      return {
        success: false,
        productsFound: 0,
        productsNew: 0,
        productsUpdated: 0,
        productsSold: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 全ページの商品一覧を取得（ページング対応）
   */
  private async getAllProducts(shopName: string): Promise<EbayProduct[]> {
    if (!chromium) {
      throw new Error('Playwright is not available. This service should only be used in CLI scripts.');
    }

    console.log(`🌐 ブラウザ起動開始: ${new Date().toISOString()}`);
    const browserStartTime = Date.now();
    
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    try {
      // ブラウザ起動時のメモリ使用量を記録
      const memoryBefore = process.memoryUsage();
      console.log(`📊 ブラウザ起動前メモリ: RSS=${Math.round(memoryBefore.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB`);

      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled',
          '--exclude-switches=enable-automation',
          '--disable-extensions-except',
          '--disable-plugins-discovery',
          '--memory-pressure-off',
          '--max_old_space_size=4096'
        ]
      });

      const browserLaunchTime = Date.now() - browserStartTime;
      console.log(`✅ ブラウザ起動完了: ${browserLaunchTime}ms`);
      
      const memoryAfter = process.memoryUsage();
      console.log(`📊 ブラウザ起動後メモリ: RSS=${Math.round(memoryAfter.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
      console.log(`📊 メモリ増加量: RSS=${Math.round((memoryAfter.rss - memoryBefore.rss) / 1024 / 1024)}MB, Heap=${Math.round((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024)}MB`);

    } catch (browserError) {
      console.error(`❌ ブラウザ起動失敗:`, browserError);
      if (browserError instanceof Error) {
        console.error(`📝 ブラウザ起動エラー名: ${browserError.name}`);
        console.error(`📝 ブラウザ起動エラーメッセージ: ${browserError.message}`);
        console.error(`📝 ブラウザ起動スタックトレース:`, browserError.stack);
      }
      throw browserError;
    }

    try {
      const page = await browser.newPage();
      
      // より自然なブラウザ環境を設定
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      // 自然なHTTPヘッダーを設定
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      });
      
      // 不要なリソースをブロック（軽量化）
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();
        
        // 動画と音声のみブロック（画像、フォント、CSS、JavaScriptは許可）
        if (resourceType === 'media' && (url.includes('video') || url.includes('audio'))) {
          route.abort();
        } else {
          route.continue();
        }
      });

      const allProducts: EbayProduct[] = [];
      const seenItemIds = new Set<string>();
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const url = `https://www.ebay.com/sch/i.html?_dkr=1&iconV2Request=true&_blrs=recall_filtering&_ssn=f_sou_shop&store_cat=0&store_name=${shopName}&_ipg=240&_sop=15&_pgn=${currentPage}`;
        
        console.log(`ページ ${currentPage} を取得中: ${url}`);
        console.log(`🕐 ページ取得開始時刻: ${new Date().toISOString()}`);
        
        try {
          console.log(`🔍 ページナビゲーション開始: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.PAGE_TIMEOUT });
          console.log(`✅ ページ ${currentPage} の読み込み完了`);
          
          // 自然な待機時間を追加
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // ページ読み込み後の状態確認
          let finalUrl = '';
          let finalTitle = '';
          let readyState = '';
          
          try {
            finalUrl = await page.url();
            console.log(`📄 最終URL: ${finalUrl}`);
          } catch (urlError) {
            console.log(`⚠️  URL取得エラー: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
          }
          
          try {
            finalTitle = await page.title();
            console.log(`📄 最終タイトル: ${finalTitle}`);
          } catch (titleError) {
            console.log(`⚠️  タイトル取得エラー: ${titleError instanceof Error ? titleError.message : String(titleError)}`);
          }
          
          try {
            readyState = await page.evaluate(() => document.readyState);
            console.log(`📄 ページ読み込み状態: ${readyState}`);
          } catch (readyStateError) {
            console.log(`⚠️  読み込み状態取得エラー: ${readyStateError instanceof Error ? readyStateError.message : String(readyStateError)}`);
          }
          
          // eBayのチャレンジページを検出
          if (finalUrl.includes('splashui/challenge') || finalTitle.includes('Pardon Our Interruption')) {
            console.log(`❌ eBayチャレンジページにリダイレクトされました`);
            console.log(`📄 チャレンジURL: ${finalUrl}`);
            console.log(`📄 チャレンジタイトル: ${finalTitle}`);
            throw new Error(`eBayチャレンジページにリダイレクトされました: ${finalTitle}`);
          }
          
        } catch (gotoError) {
          console.error(`❌ ページ ${currentPage} の読み込み失敗:`, gotoError);
          if (gotoError instanceof Error) {
            console.error(`📝 ページ読み込みエラー名: ${gotoError.name}`);
            console.error(`📝 ページ読み込みエラーメッセージ: ${gotoError.message}`);
            console.error(`📝 ページ読み込みスタックトレース:`, gotoError.stack);
          }
          
          // エラー時のページ状態を確認
          try {
            const errorUrl = await page.url();
            const errorTitle = await page.title();
            console.log(`📄 エラー時のURL: ${errorUrl}`);
            console.log(`📄 エラー時のタイトル: ${errorTitle}`);
          } catch (stateError) {
            console.log(`❌ エラー時のページ状態確認エラー: ${stateError instanceof Error ? stateError.message : String(stateError)}`);
          }
          
          throw gotoError;
        }
        
        // 商品要素が読み込まれるまで待機
        try {
          console.log(`🔍 ページ ${currentPage} の商品要素を待機中...`);
          await page.waitForSelector('.s-card__title, .s-item__title', { timeout: this.ELEMENT_TIMEOUT });
          console.log(`✅ ページ ${currentPage} の商品要素の読み込み完了`);
        } catch (selectorError) {
          console.log(`⚠️  ページ ${currentPage} の商品要素の読み込みタイムアウト、現在の要素で処理を続行`);
          if (selectorError instanceof Error) {
            console.log(`📝 セレクター待機エラー名: ${selectorError.name}`);
            console.log(`📝 セレクター待機エラーメッセージ: ${selectorError.message}`);
          }
          
          // ページの状態を確認（安全に）
          try {
            const pageUrl = await page.url();
            console.log(`📄 タイムアウト時のページURL: ${pageUrl}`);
          } catch (urlError) {
            console.log(`❌ URL確認エラー: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
          }
          
          try {
            const pageTitle = await page.title();
            console.log(`📄 タイムアウト時のページタイトル: ${pageTitle}`);
          } catch (titleError) {
            console.log(`❌ タイトル確認エラー: ${titleError instanceof Error ? titleError.message : String(titleError)}`);
          }
        }
        
        // 追加の待機時間（動的コンテンツの読み込み完了を待つ）
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 商品数が安定するまで待機
        let maxProductCount = 0;
        let stableCount = 0;
        let lastProductCount = 0;
        
        for (let i = 0; i < 10; i++) {
          // ブラウザプロセスの状態を確認
          console.log(`🔍 ループ ${i + 1}/10: ブラウザプロセス状態確認中...`);
          
          try {
            // ページの状態を確認
            const pageUrl = await page.url();
            const pageTitle = await page.title();
            console.log(`📄 ページURL: ${pageUrl}`);
            console.log(`📄 ページタイトル: ${pageTitle}`);
            
            // ページの読み込み状態を確認
            const isLoaded = await page.evaluate(() => document.readyState);
            console.log(`📄 ページ読み込み状態: ${isLoaded}`);
            
            // DOM要素の存在確認
            const titleElements = await page.$$('.s-card__title, .s-item__title');
            console.log(`🔍 タイトル要素数: ${titleElements.length}`);
            
            // メモリ使用量を確認
            const memUsage = process.memoryUsage();
            console.log(`💾 メモリ使用量: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, External=${Math.round(memUsage.external / 1024 / 1024)}MB`);
            
            // システムリソースの監視
            try {
              const cpuUsage = process.cpuUsage();
              console.log(`🖥️  CPU使用量: user=${cpuUsage.user / 1000}ms, system=${cpuUsage.system / 1000}ms`);
            } catch (cpuError) {
              console.log(`⚠️  CPU使用量取得エラー: ${cpuError instanceof Error ? cpuError.message : String(cpuError)}`);
            }
            
            // page.evaluateを排除してPlaywrightネイティブAPIを使用
            console.log(`🔍 page.$$()を実行中...`);
            let elements;
            try {
              elements = await page.$$('.s-card__title, .s-item__title');
              console.log(`✅ page.$$()完了: ${elements.length}個の要素を取得`);
            } catch (pageError) {
              console.log(`❌ page.$$()エラー発生: ${pageError instanceof Error ? pageError.message : String(pageError)}`);
              console.log(`📝 エラー名: ${pageError instanceof Error ? pageError.name : 'Unknown'}`);
              console.log(`📝 スタックトレース: ${pageError instanceof Error ? pageError.stack : 'No stack trace'}`);
              
              // ブラウザプロセスの状態を確認
              try {
                const isConnected = page.context().browser()?.isConnected();
                console.log(`🔍 ブラウザ接続状態: ${isConnected}`);
              } catch (browserError) {
                console.log(`❌ ブラウザ状態確認エラー: ${browserError instanceof Error ? browserError.message : String(browserError)}`);
              }
              
              throw pageError;
            }
            
            let validCount = 0;
          
          for (const element of elements) {
            try {
              const title = await element.textContent();
              if (!title || title.trim() === '') continue;
              
              // リンクを検索（複数の方法を試行）
              let link = null;
              
              // 方法1: 要素内のリンクを検索
              const linkElement = await element.$('a');
              if (linkElement) {
                link = await linkElement.getAttribute('href');
              }
              
              // 方法2: 親要素のリンクを検索
              if (!link) {
                const parentElement = await element.$('xpath=ancestor::*[contains(@class, "s-card") or contains(@class, "s-item")]');
                if (parentElement) {
                  const parentLinkElement = await parentElement.$('a');
                  if (parentLinkElement) {
                    link = await parentLinkElement.getAttribute('href');
                  }
                }
              }
              
              // 方法3: 祖先要素のリンクを検索
              if (!link) {
                const closestLink = await element.$('xpath=ancestor::a');
                if (closestLink) {
                  link = await closestLink.getAttribute('href');
                }
              }
              
              if (title && link && title !== '' && 
                  !title.includes('Shop on eBay') && 
                  !title.includes('Shop eBay') &&
                  !title.includes('eBay Stores') &&
                  !title.includes('Sponsored') &&
                  !title.includes('Advertisement') &&
                  link.includes('/itm/')) {
                validCount++;
              }
            } catch (error) {
              // 個別要素のエラーは無視
              continue;
            }
          }
          
          const currentCount = validCount;
          
          if (currentCount > maxProductCount) {
            maxProductCount = currentCount;
            stableCount = 0;
          }
          
          if (currentCount === lastProductCount && currentCount > 0) {
            stableCount++;
          } else {
            stableCount = 0;
            lastProductCount = currentCount;
          }
          
          console.log(`ページ ${currentPage} 商品数チェック ${i + 1}/10: ${currentCount}件 (最大: ${maxProductCount}件, 安定: ${stableCount}/3)`);
          
          if (stableCount >= 3 || (maxProductCount >= 240 && currentCount === maxProductCount)) {
            console.log(`ページ ${currentPage} の商品数が安定しました: ${currentCount}件`);
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (loopError) {
            console.error(`❌ ループ ${i + 1}でエラー発生: ${loopError instanceof Error ? loopError.message : String(loopError)}`);
            // ループのエラーは無視して続行
          }
        }
        
        // 最終確認のため追加待機
        if (maxProductCount > 0) {
          console.log(`ページ ${currentPage} 最終確認中...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        console.log(`🔍 ページ ${currentPage} の商品データを抽出中...`);
        const products: EbayProduct[] = [];
        
        try {
          // page.evaluateを排除してPlaywrightネイティブAPIを使用
          console.log(`🔍 ページ ${currentPage} の商品データを抽出中...`);
          
          // まずページの状態を確認
          const pageTitle = await page.title();
          console.log(`📄 ページタイトル: ${pageTitle}`);
          
          // 商品要素の存在確認
          const hasProductElements = await page.$('.s-card__title, .s-item__title') !== null;
          console.log(`🔍 商品要素の存在: ${hasProductElements}`);
          
          // PlaywrightのネイティブAPIを使用して商品要素を取得
          const productElements = await page.$$('.s-card__title, .s-item__title');
          console.log(`📊 商品要素数: ${productElements.length}件`);
          
          if (productElements.length === 0) {
            console.log(`⚠️  商品要素が見つかりません。ページの内容を確認します...`);
            
            // ページのHTMLの一部を確認
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
            const htmlSnippet = pageContent.substring(0, 2000);
            console.log(`📄 HTMLの一部: ${htmlSnippet}`);
            
            return [];
          }
          
          let processedCount = 0;
          let filteredCount = 0;
          
          for (let i = 0; i < productElements.length; i++) {
            const element = productElements[i];
            try {
              
              // タイトルを取得
              const title = await element.textContent();
              if (!title || title.trim() === '') {
                continue;
              }
              
              
              // リンクを取得（複数の方法を試行）
              
              let linkElement = null;
              let link = null;
              
              // 方法1: 要素内のリンクを検索
              linkElement = await element.$('a');
              if (linkElement) {
                link = await linkElement.getAttribute('href');
              }
              
              // 方法2: 親要素のリンクを検索
              if (!link) {
                const parentElement = await element.$('xpath=ancestor::*[contains(@class, "s-card") or contains(@class, "s-item")]');
                if (parentElement) {
                  linkElement = await parentElement.$('a');
                  if (linkElement) {
                    link = await linkElement.getAttribute('href');
                  }
                }
              }
              
              // 方法3: 要素の親要素を検索
              if (!link) {
                const closestLink = await element.$('xpath=ancestor::a');
                if (closestLink) {
                  link = await closestLink.getAttribute('href');
                }
              }
              
              if (!link) {
                continue;
              }
              
              
              if (!link.includes('/itm/')) {
                continue;
              }
              
              
              // フィルタリング
              if (title.includes('Shop on eBay') || 
                  title.includes('Shop eBay') ||
                  title.includes('eBay Stores') ||
                  title.includes('Sponsored') ||
                  title.includes('Advertisement')) {
                filteredCount++;
                continue;
              }
              
              
              // 価格を取得
              let price = '価格不明';
              const sCard = await element.$('xpath=ancestor::*[contains(@class, "s-card") or contains(@class, "s-item")]');
              if (sCard) {
                const priceElement = await sCard.$('.s-card__price, .s-item__price, [class*="price"]');
                if (priceElement) {
                  const priceText = await priceElement.textContent();
                  if (priceText && priceText.trim()) {
                    price = priceText.trim();
                  } else {
                  }
                } else {
                }
              } else {
              }
              
              // 商品状態を取得
              let condition: string | undefined;
              if (sCard) {
                const conditionElement = await sCard.$('.s-item__condition');
                if (conditionElement) {
                  const conditionText = await conditionElement.textContent();
                  if (conditionText && conditionText.trim()) {
                    condition = conditionText.trim();
                  } else {
                  }
                } else {
                }
              }
              
              // 画像URLを取得
              let imageUrl: string | undefined;
              if (sCard) {
                const imageElement = await sCard.$('.s-item__image img, .s-card__image img, img');
                if (imageElement) {
                  const src = await imageElement.getAttribute('src');
                  if (src) {
                    imageUrl = src;
                  } else {
                  }
                } else {
                }
              }
              
              // itemIdをURLから抽出
              const itemIdMatch = link.match(/\/itm\/(\d+)/);
              if (itemIdMatch) {
                products.push({
                  title: title.trim(),
                  price,
                  url: link,
                  itemId: itemIdMatch[1],
                  condition,
                  imageUrl,
                  quantity: 1
                });
                processedCount++;
              } else {
                console.log(`⚠️  要素 ${i + 1}: itemIdが見つからない (${link.substring(0, 50)}...)`);
              }
              
            } catch (elementError) {
              console.warn('要素処理エラー:', elementError);
            }
          }
          
          console.log(`📊 処理結果: 処理済み=${processedCount}件, フィルタリング=${filteredCount}件, 最終取得=${products.length}件`);
          console.log(`✅ ページ ${currentPage} の商品データ抽出完了: ${products.length}件`);
        } catch (evaluateError) {
          console.error(`❌ ページ ${currentPage} の商品データ抽出失敗:`, evaluateError);
          if (evaluateError instanceof Error) {
            console.error(`📝 データ抽出エラー名: ${evaluateError.name}`);
            console.error(`📝 データ抽出エラーメッセージ: ${evaluateError.message}`);
            console.error(`📝 データ抽出スタックトレース:`, evaluateError.stack);
          }
          throw evaluateError;
        }

        // 重複を除外して商品を追加
        const uniqueProducts = products.filter(product => {
          if (product.itemId && !seenItemIds.has(product.itemId)) {
            seenItemIds.add(product.itemId);
            return true;
          }
          return false;
        });
        
        console.log(`ページ ${currentPage}: ${products.length}件の商品を取得 (重複除外後: ${uniqueProducts.length}件)`);
        allProducts.push(...uniqueProducts);

        // 次のページがあるかチェック（PlaywrightネイティブAPIを使用）
        console.log(`🔍 ページ ${currentPage}: 次ページボタンを検索中...`);
        
        const nextButton1 = await page.$('.pagination__next');
        const nextButton2 = await page.$('.pagination__next:not(.pagination__next--disabled)');
        const nextButton3 = await page.$('a[aria-label="Next page"]');
        const nextButton4 = await page.$('.pagination__next[href*="_pgn="]');
        
        // クラス名の確認（evaluateを使わずに）
        let nextButton1Disabled = false;
        if (nextButton1) {
          const className = await nextButton1.getAttribute('class');
          nextButton1Disabled = className ? className.includes('pagination__next--disabled') : false;
        }
        
        const paginationInfo = {
          nextButton1: !!nextButton1,
          nextButton1Disabled,
          nextButton2: !!nextButton2,
          nextButton3: !!nextButton3,
          nextButton4: !!nextButton4,
          hasNext: !!(nextButton1 && !nextButton1Disabled) ||
                   !!(nextButton2) ||
                   !!(nextButton3) ||
                   !!(nextButton4)
        };
        
        const nextPageExists = paginationInfo.hasNext;
        const isLastPage = products.length < 240;
        
        if (isLastPage) {
          hasNextPage = false;
          console.log(`  商品数が240件未満（${products.length}件）のため、最後のページと判定`);
        } else {
          hasNextPage = Boolean(nextPageExists);
          console.log(`  商品数が240件（${products.length}件）のため、次ページボタンの状態を確認`);
        }
        
        console.log(`ページ ${currentPage} の次ページ判定: hasNextPage=${hasNextPage}`);
        currentPage++;

        // ページ間の待機
        if (hasNextPage) {
          console.log('次のページまで1秒待機...');
          await new Promise(resolve => setTimeout(resolve, this.DEFAULT_CRAWL_INTERVAL));
        }
      }

      console.log(`全ページ完了: 合計 ${allProducts.length}件の商品を取得しました`);
      return allProducts;

    } catch (pageError) {
      console.error(`❌ ページ処理中にエラー:`, pageError);
      if (pageError instanceof Error) {
        console.error(`📝 ページエラー名: ${pageError.name}`);
        console.error(`📝 ページエラーメッセージ: ${pageError.message}`);
        console.error(`📝 ページスタックトレース:`, pageError.stack);
      }
      
      // エラー発生時のシステム状態を記録
      const errorMemUsage = process.memoryUsage();
      console.error(`💾 エラー時メモリ使用量: RSS=${Math.round(errorMemUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(errorMemUsage.heapUsed / 1024 / 1024)}MB`);
      
      // ブラウザプロセスの状態を確認
      if (browser) {
        try {
          const isConnected = browser.isConnected();
          console.error(`🔍 エラー時ブラウザ接続状態: ${isConnected}`);
        } catch (browserStateError) {
          console.error(`❌ ブラウザ状態確認エラー: ${browserStateError instanceof Error ? browserStateError.message : String(browserStateError)}`);
        }
      }
      
      throw pageError;
    } finally {
      if (browser) {
        try {
          console.log(`🔒 ブラウザ終了開始: ${new Date().toISOString()}`);
          const browserCloseStartTime = Date.now();
          
          const memoryBeforeClose = process.memoryUsage();
          console.log(`📊 ブラウザ終了前メモリ: RSS=${Math.round(memoryBeforeClose.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryBeforeClose.heapUsed / 1024 / 1024)}MB`);
          
          await browser.close();
          
          const browserCloseTime = Date.now() - browserCloseStartTime;
          console.log(`✅ ブラウザ終了完了: ${browserCloseTime}ms`);
          
          const memoryAfterClose = process.memoryUsage();
          console.log(`📊 ブラウザ終了後メモリ: RSS=${Math.round(memoryAfterClose.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryAfterClose.heapUsed / 1024 / 1024)}MB`);
          console.log(`📊 メモリ解放量: RSS=${Math.round((memoryBeforeClose.rss - memoryAfterClose.rss) / 1024 / 1024)}MB, Heap=${Math.round((memoryBeforeClose.heapUsed - memoryAfterClose.heapUsed) / 1024 / 1024)}MB`);
          
        } catch (closeError) {
          console.error(`❌ ブラウザ終了失敗:`, closeError);
          if (closeError instanceof Error) {
            console.error(`📝 ブラウザ終了エラー名: ${closeError.name}`);
            console.error(`📝 ブラウザ終了エラーメッセージ: ${closeError.message}`);
            console.error(`📝 ブラウザ終了スタックトレース:`, closeError.stack);
          }
        }
      }
    }
  }

  /**
   * 商品情報をデータベースに保存・更新
   */
  private async processProducts(storeId: string, products: EbayProduct[]): Promise<{
    productsFound: number;
    productsNew: number;
    productsUpdated: number;
    productsSold: number;
  }> {
    let productsNew = 0;
    let productsUpdated = 0;
    const productsSold = 0;

    // 直前のクロール（最大30分前）の商品を取得（比較用）
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existingProducts = await prisma.product.findMany({
      where: { 
        storeId,
        lastSeenAt: {
          gte: thirtyMinutesAgo
        }
        // ステータス条件を削除 - すべての商品を比較対象にする
      }
    });

    // 既存商品の更新用（すべての商品）
    const allExistingProducts = await prisma.product.findMany({
      where: { storeId }
    });

    // const currentItemIds = new Set(products.map(p => p.itemId));
    
    console.log(`📊 比較対象: 直前のクロール商品（30分以内） ${existingProducts.length}件 vs 現在の商品 ${products.length}件`);

    // 新商品を追加（既存の商品と重複しないもののみ）
    const allExistingItemIds = new Set(allExistingProducts.map(p => p.ebayItemId));
    
    for (const product of products) {
      if (!allExistingItemIds.has(product.itemId)) {
        await prisma.product.create({
          data: {
            storeId,
            ebayItemId: product.itemId,
            title: product.title,
            price: this.parsePrice(product.price),
            currency: this.parseCurrency(product.price),
            listingUrl: product.url,
            condition: product.condition,
            imageUrl: product.imageUrl,
            quantity: product.quantity || 1,
            status: ProductStatus.ACTIVE,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          }
        });
        productsNew++;
      } else {
        // 既存商品の更新
        const existingProduct = allExistingProducts.find(p => p.ebayItemId === product.itemId);
        if (existingProduct) {
          const newPrice = this.parsePrice(product.price);
          const hasChanges = 
            existingProduct.title !== product.title ||
            existingProduct.price.toString() !== newPrice.toString() ||
            existingProduct.condition !== product.condition;

          if (hasChanges) {
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                title: product.title,
                price: newPrice,
                currency: this.parseCurrency(product.price),
                condition: product.condition,
                imageUrl: product.imageUrl,
                lastSeenAt: new Date(),
              }
            });
            productsUpdated++;
          } else {
            // 変更なしでもlastSeenAtを更新
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: { lastSeenAt: new Date() }
            });
          }
        }
      }
    }

    // 一覧から消えた商品を検出（検証待ちとしてマーク）
    // デバッグ中は一時的に無効化
    console.log(`🔍 デバッグ中: 商品の「売れた」判定を一時的に無効化しています`);
    console.log(`📊 既存商品数: ${existingProducts.length}件, 現在の商品数: ${products.length}件`);
    
    // デバッグ用: 既存商品と現在の商品の比較
    const existingItemIds = new Set(existingProducts.map(p => p.ebayItemId));
    const currentItemIdsSet = new Set(products.map(p => p.itemId));
    
    console.log(`📊 既存商品ID数: ${existingItemIds.size}件`);
    console.log(`📊 現在商品ID数: ${currentItemIdsSet.size}件`);
    
    // 重複チェック
    const commonIds = new Set([...existingItemIds].filter(id => currentItemIdsSet.has(id)));
    console.log(`📊 共通商品ID数: ${commonIds.size}件`);
    
    // 消えた商品の数（デバッグ用）
    const removedCount = existingItemIds.size - commonIds.size;
    console.log(`📊 消えた商品数: ${removedCount}件 (実際の処理は無効化中)`);
    
    // 実際の処理は一時的にコメントアウト
    /*
    for (const existingProduct of existingProducts) {
      if (!currentItemIds.has(existingProduct.ebayItemId)) {
        console.log(`🔍 商品が一覧から消えました: ${existingProduct.title} (${existingProduct.ebayItemId})`);
        
        // 即座にSOLDステータスにせず、検証待ちとしてマーク
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            status: ProductStatus.REMOVED, // 一時的にREMOVEDステータス
            verificationStatus: VerificationStatus.PENDING, // 検証待ち
            lastSeenAt: new Date(),
          }
        });
        productsSold++; // 統計上は「売れた」としてカウント（後で検証により調整される可能性）
      }
    }
    */

    return {
      productsFound: products.length,
      productsNew,
      productsUpdated,
      productsSold
    };
  }

  /**
   * 価格文字列を数値に変換
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr || priceStr === '価格不明') {
      return 0;
    }

    // 価格から数字、ドット、カンマを抽出（通貨記号は無視）
    const priceMatch = priceStr.match(/[\d,]+\.?\d*/);
    if (priceMatch) {
      const cleanPrice = priceMatch[0].replace(/,/g, '');
      const price = parseFloat(cleanPrice);

      // 価格が0以上の場合（0.00も含む）を返す
      if (price >= 0) {
        return price;
      }
    }

    console.warn(`価格の解析に失敗: "${priceStr}"`);
    return 0;
  }

  private parseCurrency(priceStr: string): string {
    if (!priceStr || priceStr === '価格不明') {
      return 'USD'; // デフォルト
    }

    // 円記号が含まれている場合はJPY
    if (priceStr.includes('円') || priceStr.includes('¥')) {
      return 'JPY';
    }
    
    // ドル記号が含まれている場合はUSD
    if (priceStr.includes('$') || priceStr.includes('USD')) {
      return 'USD';
    }
    
    // ユーロ記号が含まれている場合はEUR
    if (priceStr.includes('€') || priceStr.includes('EUR')) {
      return 'EUR';
    }
    
    // デフォルトはUSD
    return 'USD';
  }

  /**
   * クロール状態を更新
   */
  private async updateCrawlStatus(storeId: string, isRunning: boolean): Promise<void> {
    await prisma.crawlStatus.upsert({
      where: { storeId },
      update: {
        isRunning,
        startedAt: isRunning ? new Date() : null,
        serverId: isRunning ? process.env.SERVER_ID || 'local' : null,
      },
      create: {
        storeId,
        isRunning,
        startedAt: isRunning ? new Date() : null,
        serverId: isRunning ? process.env.SERVER_ID || 'local' : null,
      }
    });
  }

  /**
   * ストアを追加
   */
  async addStore(storeName: string, storeUrl?: string): Promise<string> {
    const store = await prisma.store.create({
      data: {
        storeId: storeName, // storeNameをstoreIdとして使用
        storeName,
        storeUrl: storeUrl || `https://www.ebay.com/str/${storeName}`,
        isActive: true,
        crawlInterval: 1,
      }
    });

    return store.id;
  }

  /**
   * ストア一覧を取得（ユーザー認証付き）
   */
  async getStores(userId?: string): Promise<Array<{
    id: string;
    storeName: string;
    storeUrl: string;
    isActive: boolean;
    lastCrawledAt: Date | null;
    productCount: number;
    isSubscribed: boolean;
    subscriptionId?: string;
  }>> {
    const stores = await prisma.store.findMany({
      include: {
        _count: {
          select: { products: true }
        },
        subscriptions: userId ? {
          where: { userId, isActive: true }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    return stores.map(store => ({
      id: store.id,
      storeName: store.storeName,
      storeUrl: store.storeUrl,
      isActive: store.isActive,
      lastCrawledAt: store.lastCrawledAt,
      productCount: store._count.products,
      isSubscribed: userId ? store.subscriptions.length > 0 : false,
      subscriptionId: userId && store.subscriptions.length > 0 ? store.subscriptions[0].id : undefined
    }));
  }

  /**
   * ストアの商品一覧を取得
   */
  async getStoreProducts(storeId: string, limit: number = 100, offset: number = 0): Promise<Array<{
    id: string;
    title: string;
    price: number;
    status: ProductStatus;
    lastSeenAt: Date;
    soldAt: Date | null;
  }>> {
    const products = await prisma.product.findMany({
      where: { storeId },
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        lastSeenAt: true,
        soldAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
      skip: offset
    });

    return products.map(product => ({
      id: product.id,
      title: product.title,
      price: Number(product.price),
      status: product.status,
      lastSeenAt: product.lastSeenAt,
      soldAt: product.soldAt
    }));
  }

  /**
   * ストアを購読
   */
  async subscribeToStore(userId: string, storeId: string): Promise<string> {
    // 既存の購読をチェック
    const existingSubscription = await prisma.subscription.findUnique({
      where: {
        userId_storeId: {
          userId,
          storeId
        }
      }
    });

    if (existingSubscription) {
      if (existingSubscription.isActive) {
        throw new Error('既にこのストアを購読しています');
      } else {
        // 非アクティブな購読を再アクティブ化
        const subscription = await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: { isActive: true }
        });
        return subscription.id;
      }
    }

    // 新しい購読を作成
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        storeId,
        isActive: true
      }
    });

    return subscription.id;
  }

  /**
   * ストアの購読を解除
   */
  async unsubscribeFromStore(userId: string, storeId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: {
        userId_storeId: {
          userId,
          storeId
        }
      }
    });

    if (!subscription) {
      throw new Error('このストアを購読していません');
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { isActive: false }
    });
  }

  /**
   * ユーザーの購読ストア一覧を取得
   */
  async getUserSubscriptions(userId: string): Promise<Array<{
    id: string;
    storeId: string;
    storeName: string;
    storeUrl: string;
    isActive: boolean;
    productCount: number;
    lastCrawledAt: Date | null;
  }>> {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        store: {
          include: {
            _count: {
              select: { products: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return subscriptions.map(sub => ({
      id: sub.id,
      storeId: sub.store.id,
      storeName: sub.store.storeName,
      storeUrl: sub.store.storeUrl,
      isActive: sub.isActive,
      productCount: sub.store._count.products,
      lastCrawledAt: sub.store.lastCrawledAt
    }));
  }
}

// シングルトンインスタンス
export const ebayCrawlerService = new EbayCrawlerService();

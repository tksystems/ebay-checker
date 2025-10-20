import { prisma } from "@/lib/prisma";
import { ProductStatus, CrawlLogStatus, VerificationStatus } from "@prisma/client";
import { load, CheerioAPI, Element } from 'cheerio';

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
  private readonly MAX_PAGES_PER_SESSION = 5; // セッションあたりの最大ページ数

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

    // リトライ機能付きでブラウザを起動
    return await this.launchBrowserWithRetry(async (browser) => {
      return await this.crawlAllPages(browser, shopName);
    });
  }

  /**
   * リトライ機能付きブラウザ起動
   */
  private async launchBrowserWithRetry<T>(operation: (browser: import('playwright').Browser) => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      let browser: import('playwright').Browser | null = null;
      
      try {
        console.log(`🔄 ブラウザ起動試行 ${attempt}/${this.MAX_RETRIES}`);
        
        browser = await chromium!.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--memory-pressure-off',
            '--max_old_space_size=512'
          ]
        });

        const result = await operation(browser);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        console.error(`❌ ブラウザ操作失敗 (試行 ${attempt}/${this.MAX_RETRIES}):`, lastError.message);
        
        // ブラウザが起動していた場合は確実に閉じる
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.warn('ブラウザのクローズ中にエラー:', closeError);
          }
        }
        
        // 最後の試行でない場合は待機
        if (attempt < this.MAX_RETRIES) {
          const waitTime = attempt * 2000; // 2秒、4秒、6秒...
          console.log(`⏳ ${waitTime}ms待機してからリトライします...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw new Error(`ブラウザ操作が${this.MAX_RETRIES}回連続で失敗しました。最後のエラー: ${lastError?.message}`);
  }

  /**
   * 全ページをクロール（cheerioベース最適化版）
   */
  private async crawlAllPages(browser: import('playwright').Browser, shopName: string): Promise<EbayProduct[]> {
    const allProducts: EbayProduct[] = [];
    const seenItemIds = new Set<string>();
    let currentPage = 1;
    let hasNextPage = true;
    let sessionPageCount = 0;

    // 単一のコンテキストを使用（ブラウザクラッシュを回避）
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // ページのタイムアウト設定
      page.setDefaultTimeout(this.PAGE_TIMEOUT);
      page.setDefaultNavigationTimeout(this.PAGE_TIMEOUT);

      // リソースブロック設定（画像は許可、font/mediaはブロック）
      await page.route('**/*', (route: import('playwright').Route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();

        if (['font'].includes(resourceType)) {
          route.abort();
        } else if (resourceType === 'media' && (url.includes('video') || url.includes('audio'))) {
          route.abort();
        } else {
          route.continue();
        }
      });

      while (hasNextPage && sessionPageCount < this.MAX_PAGES_PER_SESSION) {
        const url = `https://www.ebay.com/sch/i.html?_dkr=1&iconV2Request=true&_blrs=recall_filtering&_ssn=f_sou_shop&store_cat=0&store_name=${shopName}&_ipg=240&_sop=15&_pgn=${currentPage}`;
        
        console.log(`🌐 ページ ${currentPage} を取得中: ${url}`);

        try {
          // ページを読み込み
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.PAGE_TIMEOUT });
          await page.waitForLoadState('domcontentloaded');
          
          // 商品要素の読み込みを待機
          try {
            await page.waitForSelector('.s-card__title, .s-item__title', {
              timeout: this.ELEMENT_TIMEOUT,
              state: 'attached',
            });
            console.log(`✅ ページ ${currentPage} の商品要素の読み込み完了`);
          } catch {
            console.log(`⚠️ ページ ${currentPage} の商品要素がまだ安定していない可能性があります（タイムアウト）。続行します。`);
          }

          // 動的コンテンツの読み込み完了を待つ
          await new Promise(resolve => setTimeout(resolve, 2000));

          // HTMLを取得してcheerioで解析
          const html = await page.content();
          const $ = load(html);

          // 商品データをcheerioで抽出
          const products = this.extractProductsFromHTML($);
          
          // 次ページ判定をHTMLベースで実行
          hasNextPage = this.checkNextPageFromHTML($, products.length);

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

          console.log(`ページ ${currentPage} の次ページ判定: hasNextPage=${hasNextPage}`);
          currentPage++;
          sessionPageCount++;

          if (sessionPageCount >= this.MAX_PAGES_PER_SESSION) {
            console.log(`⚠️ セッション制限に達しました (${this.MAX_PAGES_PER_SESSION}ページ)。`);
            hasNextPage = false;
          }

          if (hasNextPage) {
            console.log('⏳ 次のページまで1秒待機...');
            await new Promise(resolve => setTimeout(resolve, this.DEFAULT_CRAWL_INTERVAL));
          }

          if (process.env.NODE_ENV === 'production') {
            const memUsage = process.memoryUsage();
            console.log(`📊 メモリ使用量: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
          }

        } catch (error) {
          console.error(`❌ ページ ${currentPage} の処理に失敗:`, error);
          throw new Error(`ページ処理失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`🎉 全ページ完了: 合計 ${allProducts.length}件の商品を取得しました`);
      return allProducts;

    } finally {
      // コンテキストを閉じる
      try {
        await context.close();
      } catch (error) {
        console.warn('コンテキストのクローズ中にエラー:', error);
      }
    }
  }

  /**
   * HTMLから商品データを抽出（cheerio使用）
   */
  private extractProductsFromHTML($: CheerioAPI): EbayProduct[] {
    const products: EbayProduct[] = [];
    
    $('.s-card__title, .s-item__title').each((_: number, element: Element) => {
      const $element = $(element);
      const title = $element.text().trim();
      const $link = $element.closest('a');
      const link = $link.attr('href');

      if (title && link && title !== '' &&
          !title.includes('Shop on eBay') &&
          !title.includes('Shop eBay') &&
          !title.includes('eBay Stores') &&
          !title.includes('Sponsored') &&
          !title.includes('Advertisement') &&
          link.includes('/itm/')) {

        // 価格を取得（複数のセレクターを試行）
        let price = '価格不明';
        const $card = $element.closest('.s-card, .s-item');

        if ($card.length) {
          const priceSelectors = [
            '.s-card__price',
            '.s-item__price',
            '.su-styled-text.primary.bold.large-1.s-card__price',
            'span.su-styled-text.primary.bold.large-1.s-card__price',
            '.su-styled-text.s-card__price',
            '[class*="s-card__price"]',
            '[class*="price"]'
          ];

          for (const selector of priceSelectors) {
            const priceText = $card.find(selector).first().text().trim();
            if (priceText) {
              price = priceText;
              break;
            }
          }
        }

        const condition = $card.find('.s-item__condition').first().text().trim();
        const imageUrl = $card.find('.s-item__image img, .s-card__image img, img').first().attr('src');
        const itemIdMatch = link.match(/\/itm\/(\d+)/);
        const itemId = itemIdMatch ? itemIdMatch[1] : undefined;

        if (itemId) {
          products.push({
            title,
            price,
            url: link,
            itemId,
            condition: condition || undefined,
            imageUrl: imageUrl || undefined,
            quantity: 1
          });
        }
      }
    });

    return products;
  }

  /**
   * HTMLから次ページの存在を判定（cheerio使用）
   */
  private checkNextPageFromHTML($: CheerioAPI, currentProductCount: number): boolean {
    // 商品数が240件未満の場合は最後のページ
    if (currentProductCount < 240) {
      console.log(`📘 商品数が240件未満（${currentProductCount}件）のため、最後のページと判定`);
      return false;
    }

    // 次ページボタンの存在をチェック
    const nextButtonSelectors = [
      '.pagination__next:not(.pagination__next--disabled)',
      'a[aria-label="Next page"]',
      '.pagination__next[href*="_pgn="]'
    ];

    for (const selector of nextButtonSelectors) {
      if ($(selector).length > 0) {
        console.log(`📗 次ページボタンが見つかりました: ${selector}`);
        return true;
      }
    }

    console.log(`📘 次ページボタンが見つからないため、最後のページと判定`);
    return false;
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
    let productsSold = 0;

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

    const currentItemIds = new Set(products.map(p => p.itemId));
    
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

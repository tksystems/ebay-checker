import { prisma } from "@/lib/prisma";
import { ProductStatus, CrawlLogStatus, VerificationStatus } from "@prisma/client";

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

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // 不要なリソースをブロック（軽量化）
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();
        
        // 画像とフォントのみブロック（CSSとJavaScriptは許可）
        if (['image', 'font'].includes(resourceType)) {
          route.abort();
        } else if (resourceType === 'media' && (url.includes('video') || url.includes('audio'))) {
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.PAGE_TIMEOUT });
        
        // 商品要素が読み込まれるまで待機
        try {
          await page.waitForSelector('.s-card__title, .s-item__title', { timeout: this.ELEMENT_TIMEOUT });
          console.log(`ページ ${currentPage} の商品要素の読み込み完了`);
        } catch {
          console.log(`ページ ${currentPage} の商品要素の読み込みタイムアウト、現在の要素で処理を続行`);
        }
        
        // 追加の待機時間（動的コンテンツの読み込み完了を待つ）
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 商品数が安定するまで待機
        let maxProductCount = 0;
        let stableCount = 0;
        let lastProductCount = 0;
        
        for (let i = 0; i < 10; i++) {
          const currentCount = await page.evaluate(() => {
            const elements = document.querySelectorAll('.s-card__title, .s-item__title');
            let validCount = 0;
            elements.forEach((element) => {
              const title = element.textContent?.trim();
              const link = element.closest('a')?.href;
              if (title && link && title !== '' && 
                  !title.includes('Shop on eBay') && 
                  !title.includes('Shop eBay') &&
                  !title.includes('eBay Stores') &&
                  !title.includes('Sponsored') &&
                  !title.includes('Advertisement') &&
                  link.includes('/itm/')) {
                validCount++;
              }
            });
            return validCount;
          });
          
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
        }
        
        // 最終確認のため追加待機
        if (maxProductCount > 0) {
          console.log(`ページ ${currentPage} 最終確認中...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        const products = await page.evaluate(() => {
          const productElements = document.querySelectorAll('.s-card__title, .s-item__title');
          const products: EbayProduct[] = [];
          
          productElements.forEach((element) => {
            const title = element.textContent?.trim();
            const link = element.closest('a')?.href;
            
            if (title && link && title !== '' && 
                !title.includes('Shop on eBay') && 
                !title.includes('Shop eBay') &&
                !title.includes('eBay Stores') &&
                !title.includes('Sponsored') &&
                !title.includes('Advertisement') &&
                link.includes('/itm/')) {
              
              // 価格を取得（複数のセレクターを試行）
              let price = '価格不明';
              const sCard = element.closest('.s-card') || element.closest('.s-item');
              
              if (sCard) {
                // 複数の価格セレクターを試行
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
                  const priceElement = sCard.querySelector(selector);
                  if (priceElement && priceElement.textContent?.trim()) {
                    price = priceElement.textContent.trim();
                    console.log(`価格取得成功 - タイトル: ${title}, セレクター: ${selector}, 価格: ${price}`);
                    break;
                  }
                }
                
                if (price === '価格不明') {
                  console.log(`価格取得失敗 - タイトル: ${title}`);
                  console.log(`利用可能な要素:`, sCard.innerHTML.substring(0, 1000));
                  console.log(`価格関連の要素:`, sCard.querySelectorAll('[class*="price"]').length);
                }
              }
              
              // 商品状態を取得
              const conditionElement = sCard?.querySelector('.s-item__condition');
              const condition = conditionElement?.textContent?.trim();
              
              // 画像URLを取得
              const imageElement = sCard?.querySelector('.s-item__image img, .s-card__image img, img');
              const imageUrl = imageElement?.getAttribute('src');
              
              // itemIdをURLから抽出
              let itemId: string | undefined;
              const itemIdMatch = link.match(/\/itm\/(\d+)/);
              if (itemIdMatch) {
                itemId = itemIdMatch[1];
              }
              
              if (itemId) {
                products.push({
                  title,
                  price,
                  url: link,
                  itemId,
                  condition,
                  imageUrl: imageUrl || undefined,
                  quantity: 1 // デフォルト値
                });
              }
            }
          });
          
          return products;
        });

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

        // 次のページがあるかチェック
        const paginationInfo = await page.evaluate(() => {
          const nextButton1 = document.querySelector('.pagination__next');
          const nextButton2 = document.querySelector('.pagination__next:not(.pagination__next--disabled)');
          const nextButton3 = document.querySelector('a[aria-label="Next page"]');
          const nextButton4 = document.querySelector('.pagination__next[href*="_pgn="]');
          
          return {
            nextButton1: !!nextButton1,
            nextButton1Disabled: nextButton1 ? nextButton1.classList.contains('pagination__next--disabled') : false,
            nextButton2: !!nextButton2,
            nextButton3: !!nextButton3,
            nextButton4: !!nextButton4,
            hasNext: !!(nextButton1 && !nextButton1.classList.contains('pagination__next--disabled')) ||
                     !!(nextButton2) ||
                     !!(nextButton3) ||
                     !!(nextButton4)
          };
        });
        
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

    } finally {
      await browser.close();
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

#!/usr/bin/env tsx

/**
 * eBayストア監視スクリプト
 * バックグラウンドでストアを定期的にクローリングし、変化を検知する
 */

import { PrismaClient, NotificationType, NotificationStatus } from '@prisma/client';
import { ebayCrawlerService, CrawlResult, EbayProduct } from '../src/services/ebayCrawlerService';
import { getCrawlConfig } from '../src/config/proxy';

const prisma = new PrismaClient();

// メモリベースの商品比較システム
interface StoreProductCache {
  storeId: string;
  products: Map<string, EbayProduct>; // itemId -> EbayProduct
  lastUpdated: Date;
}

interface StoreWithCrawlStatus {
  id: string;
  storeName: string;
  storeUrl: string;
  isActive: boolean;
  crawlInterval: number;
  lastCrawledAt: Date | null;
  crawlStatus: {
    id: string;
    isRunning: boolean;
    startedAt: Date | null;
    serverId: string | null;
  } | null;
}

class StoreObserver {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly serverId: string;
  private resourceMonitorInterval: NodeJS.Timeout | null = null;
  private storeProductCache: Map<string, StoreProductCache> = new Map();
  private isProcessingStore: boolean = false; // ストア処理中のフラグ

  constructor() {
    this.serverId = process.env.SERVER_ID || `server-${Date.now()}`;
  }

  /**
   * 監視を開始
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('監視は既に実行中です');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 eBayストア監視を開始します (Server ID: ${this.serverId})`);

    // 初回実行
    await this.runObservation();

    // 定期実行（1分間隔）
    this.intervalId = setInterval(async () => {
      await this.runObservation();
    }, 1 * 60 * 1000); // 1分

    // リソース監視（30秒間隔）
    this.resourceMonitorInterval = setInterval(() => {
      this.logResourceUsage();
    }, 30 * 1000); // 30秒
  }

  /**
   * 監視を停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('監視は実行されていません');
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
      this.resourceMonitorInterval = null;
    }

    // このサーバーのロック状態をクリーンアップ
    try {
      await prisma.crawlStatus.updateMany({
        where: {
          serverId: this.serverId,
          isRunning: true
        },
        data: {
          isRunning: false,
          serverId: null,
          startedAt: null
        }
      });
      console.log('🧹 このサーバーのロック状態をクリーンアップしました');
    } catch (error) {
      console.error('❌ ロック状態のクリーンアップ中にエラー:', error);
    }

    console.log('🛑 eBayストア監視を停止しました');
  }

  /**
   * 監視実行
   */
  private async runObservation(): Promise<void> {
    try {
      console.log(`\n📊 監視実行開始: ${new Date().toISOString()}`);

      // 古いロック状態をクリーンアップ
      await this.cleanupStaleLocks();

      // アクティブなストアを取得
      const stores = await prisma.store.findMany({
        where: { isActive: true },
        include: {
          crawlStatus: true
        }
      });

      console.log(`監視対象ストア数: ${stores.length}件`);

      // ストア毎に順次処理（並列化を完全に防ぐ）
      for (const store of stores) {
        // 既に他のストアが処理中の場合はスキップ
        if (this.isProcessingStore) {
          console.log(`⏭️  ストア「${store.storeName}」は他のストアが処理中のためスキップします`);
          continue;
        }

        console.log(`🔄 ストア「${store.storeName}」の処理を開始します...`);
        this.isProcessingStore = true;
        
        try {
          await this.observeStore(store);
          console.log(`✅ ストア「${store.storeName}」の処理が完了しました`);
        } catch (error) {
          console.error(`❌ ストア「${store.storeName}」の処理中にエラー:`, error);
        } finally {
          this.isProcessingStore = false;
        }
        
        // ストア間の待機時間を追加（メモリ解放のため）
        const crawlConfig = getCrawlConfig();
        const storeIntervalMs = crawlConfig.storeInterval;
        console.log(`⏳ 次のストア処理まで${storeIntervalMs / 1000}秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, storeIntervalMs));
      }

      console.log(`✅ 監視実行完了: ${new Date().toISOString()}`);

    } catch (error) {
      console.error('❌ 監視実行中にエラーが発生しました:', error);
    }
  }

  /**
   * 古いロック状態をクリーンアップ
   */
  private async cleanupStaleLocks(): Promise<void> {
    try {
      // 30分以上前から実行中のロックをクリーンアップ
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      
      const result = await prisma.crawlStatus.updateMany({
        where: {
          isRunning: true,
          startedAt: {
            lt: thirtyMinutesAgo
          }
        },
        data: {
          isRunning: false,
          serverId: null,
          startedAt: null
        }
      });

      if (result.count > 0) {
        console.log(`🧹 ${result.count}件の古いロック状態をクリーンアップしました`);
      }
    } catch (error) {
      console.error('❌ ロック状態のクリーンアップ中にエラー:', error);
    }
  }

  /**
   * 個別ストアの監視
   */
  private async observeStore(store: StoreWithCrawlStatus): Promise<void> {
    const startTime = Date.now();
    let memoryUsage: NodeJS.MemoryUsage | null = null;
    
    try {
      // メモリ使用量を記録
      memoryUsage = process.memoryUsage();
      console.log(`📊 メモリ使用量 (開始時): RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      
      // 他のサーバーが実行中かチェック
      if (store.crawlStatus && store.crawlStatus.isRunning && store.crawlStatus.serverId !== this.serverId) {
        console.log(`⏭️  ストア「${store.storeName}」は他のサーバーで実行中です (${store.crawlStatus.serverId})`);
        return;
      }

      // クロール間隔をチェック
      const lastCrawledAt = store.lastCrawledAt;
      const now = new Date();
      const timeSinceLastCrawl = lastCrawledAt ? now.getTime() - lastCrawledAt.getTime() : Infinity;
      const crawlIntervalMs = store.crawlInterval * 1000;

      if (timeSinceLastCrawl < crawlIntervalMs) {
        const remainingTime = Math.ceil((crawlIntervalMs - timeSinceLastCrawl) / 1000);
        console.log(`⏳ ストア「${store.storeName}」は${remainingTime}秒後にクロール予定です`);
        return;
      }

      console.log(`🔍 ストア「${store.storeName}」をクローリング中...`);
      console.log(`🕐 開始時刻: ${new Date().toISOString()}`);
      
      // システム情報をログ出力
      console.log(`🖥️  システム情報: Node.js ${process.version}, プラットフォーム: ${process.platform}, アーキテクチャ: ${process.arch}`);
      
      // 新しいメモリベースの比較システムを使用
      const result = await this.crawlStoreWithMemoryComparison(store.id);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (result.success) {
        console.log(`✅ ストア「${store.storeName}」クロール完了:`);
        console.log(`   商品数: ${result.productsFound}件`);
        console.log(`   新商品: ${result.productsNew}件`);
        console.log(`   更新: ${result.productsUpdated}件`);
        console.log(`   売れた: ${result.productsSold}件`);
        console.log(`   実行時間: ${result.duration}ms`);
        console.log(`   総実行時間: ${duration}ms`);

        // 変化があった場合は通知
        if (result.productsNew > 0 || result.productsSold > 0) {
          await this.notifyChanges(store, result);
        }
      } else {
        console.error(`❌ ストア「${store.storeName}」クロール失敗: ${result.errorMessage}`);
        console.error(`🕐 失敗時刻: ${new Date().toISOString()}`);
        console.error(`⏱️  失敗までの実行時間: ${duration}ms`);
      }

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`❌ ストア「${store.storeName}」の監視中にエラー:`, error);
      console.error(`🕐 エラー発生時刻: ${new Date().toISOString()}`);
      console.error(`⏱️  エラーまでの実行時間: ${duration}ms`);
      
      // エラーの詳細情報を出力
      if (error instanceof Error) {
        console.error(`📝 エラー名: ${error.name}`);
        console.error(`📝 エラーメッセージ: ${error.message}`);
        console.error(`📝 スタックトレース:`, error.stack);
      }
      
      // メモリ使用量を記録
      const finalMemoryUsage = process.memoryUsage();
      console.error(`📊 メモリ使用量 (エラー時): RSS=${Math.round(finalMemoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(finalMemoryUsage.heapUsed / 1024 / 1024)}MB`);
      
      if (memoryUsage) {
        const memoryDiff = {
          rss: finalMemoryUsage.rss - memoryUsage.rss,
          heapUsed: finalMemoryUsage.heapUsed - memoryUsage.heapUsed
        };
        console.error(`📊 メモリ増加量: RSS=${Math.round(memoryDiff.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryDiff.heapUsed / 1024 / 1024)}MB`);
      }
    }
  }

  /**
   * リソース使用量をログ出力
   */
  private logResourceUsage(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    console.log(`📊 リソース監視: RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB, External=${Math.round(memoryUsage.external / 1024 / 1024)}MB`);
    console.log(`📊 CPU使用量: User=${cpuUsage.user / 1000}ms, System=${cpuUsage.system / 1000}ms`);
    
    // メモリ使用量が異常に高い場合は警告
    if (memoryUsage.rss > 1024 * 1024 * 1024) { // 1GB
      console.warn(`⚠️  メモリ使用量が高いです: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB`);
    }
    
    if (memoryUsage.heapUsed > 512 * 1024 * 1024) { // 512MB
      console.warn(`⚠️  ヒープ使用量が高いです: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    }
  }

  /**
   * メモリベースの商品比較システムでストアをクロール
   */
  private async crawlStoreWithMemoryComparison(storeId: string): Promise<CrawlResult> {
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

      // クロール状態を更新
      await this.updateCrawlStatus(store.id, true);

      try {
        // 全ページの商品を取得
        const currentProducts = await this.getAllProducts(store.storeName, store.id);
        
        // メモリキャッシュをチェック
        const cache = this.storeProductCache.get(storeId);
        
        let result: {
          productsFound: number;
          productsNew: number;
          productsUpdated: number;
          productsSold: number;
        };

        if (!cache) {
          // 初回クロール：商品をメモリに保存（DBには保存しない）
          console.log(`🆕 初回クロール: 商品をメモリに保存します (${currentProducts.length}件)`);
          
          const productMap = new Map<string, EbayProduct>();
          currentProducts.forEach(product => {
            productMap.set(product.itemId, product);
          });
          
          this.storeProductCache.set(storeId, {
            storeId,
            products: productMap,
            lastUpdated: new Date()
          });
          
          result = {
            productsFound: currentProducts.length,
            productsNew: 0,
            productsUpdated: 0,
            productsSold: 0
          };
          
        } else {
          // 2回目以降：メモリの商品一覧と比較
          console.log(`🔍 2回目以降のクロール: メモリの商品一覧と比較します`);
          console.log(`📊 メモリ内商品数: ${cache.products.size}件, 現在の商品数: ${currentProducts.length}件`);
          
          result = await this.compareWithMemoryCache(storeId, currentProducts, cache);
        }

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
   * メモリキャッシュと現在の商品を比較
   */
  private async compareWithMemoryCache(
    storeId: string, 
    currentProducts: EbayProduct[], 
    cache: StoreProductCache
  ): Promise<{
    productsFound: number;
    productsNew: number;
    productsUpdated: number;
    productsSold: number;
  }> {
    let productsNew = 0;
    let productsUpdated = 0;
    let productsSold = 0;

    // 現在の商品IDセット
    const currentItemIds = new Set(currentProducts.map(p => p.itemId));
    const cachedItemIds = new Set(cache.products.keys());

    console.log(`📊 比較対象: メモリ内 ${cachedItemIds.size}件 vs 現在 ${currentItemIds.size}件`);

    // 新商品を検出（現在にあるがメモリにない商品）
    const newItemIds = new Set([...currentItemIds].filter(id => !cachedItemIds.has(id)));
    console.log(`🆕 新商品: ${newItemIds.size}件`);

    // 消えた商品を検出（メモリにあるが現在にない商品）
    const removedItemIds = new Set([...cachedItemIds].filter(id => !currentItemIds.has(id)));
    console.log(`❌ 消えた商品: ${removedItemIds.size}件`);

    // 消えた商品が5件を超える場合は、比較元がおかしいと判定
    const REMOVED_THRESHOLD = 5;
    if (removedItemIds.size > REMOVED_THRESHOLD) {
      console.warn(`⚠️  消えた商品が${removedItemIds.size}件と異常に多いため、比較元（メモリキャッシュ）が不正確と判定します`);
      console.warn(`⚠️  DBへの保存をスキップし、比較元を現在の商品一覧で更新します`);
      
      // DBには保存せず、比較元を更新するだけ
      // productsSoldはカウントしない
    } else if (removedItemIds.size > 0) {
      // 消えた商品が5件以下の場合のみDBに保存
      console.log(`💾 消えた商品をDBに保存します...`);
      
      // 消えた商品をDBに保存（検証待ちとしてマーク）
      for (const itemId of removedItemIds) {
        const cachedProduct = cache.products.get(itemId);
        if (cachedProduct) {
          try {
            await this.saveRemovedProductToDatabase(storeId, cachedProduct);
            productsSold++;
          } catch (error) {
            console.error(`❌ 商品 ${itemId} の保存に失敗:`, error);
            // エラーが発生しても処理を続行
          }
        }
      }
    }

    // 新商品は検出するがDBには保存しない（メモリのみで管理）
    if (newItemIds.size > 0) {
      console.log(`🆕 新商品 ${newItemIds.size}件を検出しました（DBには保存しません）`);
      productsNew = newItemIds.size; // 統計用のカウントのみ
    }

    // ベースラインを常に更新（最新の状態を保持）
    // 消えた商品が5件を超えた場合も、比較元を更新する
    const newProductMap = new Map<string, EbayProduct>();
    currentProducts.forEach(product => {
      newProductMap.set(product.itemId, product);
    });
    
    this.storeProductCache.set(storeId, {
      storeId,
      products: newProductMap,
      lastUpdated: new Date()
    });
    
    if (newItemIds.size > 0 || removedItemIds.size > 0) {
      if (removedItemIds.size > REMOVED_THRESHOLD) {
        console.log(`🔄 比較元を更新しました（異常検出のためDB保存はスキップ）: ${newProductMap.size}件の商品をメモリに保存`);
      } else {
        console.log(`🔄 ベースライン更新完了: ${newProductMap.size}件の商品をメモリに保存`);
      }
    } else {
      console.log(`✅ 変化なし: メモリの商品一覧を更新しました`);
    }

    return {
      productsFound: currentProducts.length,
      productsNew,
      productsUpdated,
      productsSold
    };
  }


  /**
   * 消えた商品をデータベースに保存（検証待ちとしてマーク）
   */
  private async saveRemovedProductToDatabase(storeId: string, product: EbayProduct): Promise<void> {
    // 既存の商品がある場合は更新、ない場合は作成
    await prisma.product.upsert({
      where: {
        ebayItemId: product.itemId
      },
      update: {
        // 既存商品のステータスをREMOVEDに更新し、検証待ちとしてマーク
        status: 'REMOVED',
        verificationStatus: 'PENDING',
        lastSeenAt: new Date(),
      },
      create: {
        storeId,
        ebayItemId: product.itemId,
        title: product.title,
        price: this.parsePrice(product.price),
        currency: this.parseCurrency(product.price),
        listingUrl: product.url,
        condition: product.condition,
        imageUrl: product.imageUrl,
        quantity: product.quantity || 1,
        status: 'REMOVED',
        verificationStatus: 'PENDING',
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      }
    });
  }

  /**
   * 価格文字列を数値に変換
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr || priceStr === '価格不明') {
      return 0;
    }

    const priceMatch = priceStr.match(/[\d,]+\.?\d*/);
    if (priceMatch) {
      const cleanPrice = priceMatch[0].replace(/,/g, '');
      const price = parseFloat(cleanPrice);
      return price >= 0 ? price : 0;
    }

    return 0;
  }

  /**
   * 通貨を解析
   */
  private parseCurrency(priceStr: string): string {
    if (!priceStr || priceStr === '価格不明') {
      return 'USD';
    }

    if (priceStr.includes('円') || priceStr.includes('¥')) {
      return 'JPY';
    }
    
    if (priceStr.includes('$') || priceStr.includes('USD')) {
      return 'USD';
    }
    
    if (priceStr.includes('€') || priceStr.includes('EUR')) {
      return 'EUR';
    }
    
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
        serverId: isRunning ? this.serverId : null,
      },
      create: {
        storeId,
        isRunning,
        startedAt: isRunning ? new Date() : null,
        serverId: isRunning ? this.serverId : null,
      }
    });
  }

  /**
   * 全ページの商品一覧を取得（ebayCrawlerServiceから移植）
   */
  private async getAllProducts(shopName: string, storeId?: string): Promise<EbayProduct[]> {
    console.log(`🌐 ストア「${shopName}」の商品取得を開始します...`);
    
    // クロール設定を取得
    const crawlConfig = getCrawlConfig();
    
    // ブラウザ起動前の待機（前のブラウザの完全終了を待つ）
    console.log(`⏳ ブラウザ起動前の待機中... (${crawlConfig.initialDelay}ms)`);
    await new Promise(resolve => setTimeout(resolve, crawlConfig.initialDelay));
    
    // 処理中のフラグをチェック
    if (this.isProcessingStore) {
      console.log(`🔒 ストア「${shopName}」の処理中です。並列実行を防ぎます。`);
    }
    
    const result = await ebayCrawlerService.getAllProducts(shopName, storeId);
    
    console.log(`✅ ストア「${shopName}」の商品取得が完了しました (${result.length}件)`);
    
    // ブラウザ終了後の待機（メモリ解放のため）
    console.log(`⏳ ブラウザ終了後の待機中... (${crawlConfig.pageLoadDelay}ms)`);
    await new Promise(resolve => setTimeout(resolve, crawlConfig.pageLoadDelay));
    
    return result;
  }

  /**
   * 変化を通知
   */
  private async notifyChanges(store: StoreWithCrawlStatus, result: CrawlResult): Promise<void> {
    try {
      // 通知設定を取得
      const notificationSettings = await prisma.notificationSettings.findMany({
        where: {
          OR: [
            { notifyOnNewProduct: true },
            { notifyOnSold: true }
          ]
        },
        include: {
          user: true
        }
      });

      for (const setting of notificationSettings) {
        // 新商品の通知
        if (result.productsNew > 0 && setting.notifyOnNewProduct) {
          await this.sendNotification(
            setting.user.id,
            '🆕 新商品が追加されました',
            `ストア「${store.storeName}」に${result.productsNew}件の新商品が追加されました`,
            NotificationType.EMAIL
          );
        }

        // 売れた商品の通知
        if (result.productsSold > 0 && setting.notifyOnSold) {
          await this.sendNotification(
            setting.user.id,
            '💰 商品が売れました',
            `ストア「${store.storeName}」で${result.productsSold}件の商品が売れました`,
            NotificationType.EMAIL
          );
        }
      }

    } catch (error) {
      console.error('通知送信中にエラーが発生しました:', error);
    }
  }

  /**
   * 通知を送信
   */
  private async sendNotification(
    userId: string, 
    subject: string, 
    message: string, 
    type: NotificationType
  ): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type,
          subject,
          message,
          status: NotificationStatus.PENDING
        }
      });

      console.log(`📧 通知を送信しました: ${subject}`);
    } catch (error) {
      console.error('通知の保存に失敗しました:', error);
    }
  }

  /**
   * グレースフルシャットダウン
   */
  async shutdown(): Promise<void> {
    console.log('\n🛑 シャットダウンシグナルを受信しました...');
    await this.stop();
    
    // 実行中のクロールを待機
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await prisma.$disconnect();
    console.log('👋 監視スクリプトを終了します');
    process.exit(0);
  }
}

// メイン実行
async function main(): Promise<void> {
  const observer = new StoreObserver();

  // シグナルハンドラーを設定
  process.on('SIGINT', () => observer.shutdown());
  process.on('SIGTERM', () => observer.shutdown());

  // 監視を開始
  await observer.start();

  // プロセスを維持
  process.on('uncaughtException', (error) => {
    console.error('未処理の例外:', error);
    observer.shutdown();
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('未処理のPromise拒否:', reason);
    observer.shutdown();
  });
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main().catch((error) => {
    console.error('監視スクリプトの起動に失敗しました:', error);
    process.exit(1);
  });
}

export { StoreObserver };

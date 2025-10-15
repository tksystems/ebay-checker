#!/usr/bin/env tsx

/**
 * eBayストア監視スクリプト
 * バックグラウンドでストアを定期的にクローリングし、変化を検知する
 */

import { PrismaClient, NotificationType, NotificationStatus } from '@prisma/client';
import { ebayCrawlerService, CrawlResult } from '../src/services/ebayCrawlerService';

const prisma = new PrismaClient();

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

      for (const store of stores) {
        await this.observeStore(store);
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
    try {
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
      
      const result = await ebayCrawlerService.crawlStore(store.id);
      
      if (result.success) {
        console.log(`✅ ストア「${store.storeName}」クロール完了:`);
        console.log(`   商品数: ${result.productsFound}件`);
        console.log(`   新商品: ${result.productsNew}件`);
        console.log(`   更新: ${result.productsUpdated}件`);
        console.log(`   売れた: ${result.productsSold}件`);
        console.log(`   実行時間: ${result.duration}ms`);

        // 変化があった場合は通知
        if (result.productsNew > 0 || result.productsSold > 0) {
          await this.notifyChanges(store, result);
        }
      } else {
        console.error(`❌ ストア「${store.storeName}」クロール失敗: ${result.errorMessage}`);
      }

    } catch (error) {
      console.error(`❌ ストア「${store.storeName}」の監視中にエラー:`, error);
    }
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

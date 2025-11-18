import { EbayDetailVerificationService } from './ebayDetailVerificationService';
import { NotificationService } from './notificationService';
import { VerificationBatchProcessor } from './verificationBatchProcessor';
import { prisma } from '@/lib/prisma';
import { VerificationStatus, ProductStatus } from '@prisma/client';

/**
 * 検証と通知を統合したサービス
 * 検証処理後に適切な通知を送信する
 */
export class VerificationNotificationService {
  private verificationService: EbayDetailVerificationService;
  private notificationService: NotificationService;
  private batchProcessor: VerificationBatchProcessor;

  constructor(
    verificationService?: EbayDetailVerificationService,
    notificationService?: NotificationService,
    batchProcessor?: VerificationBatchProcessor
  ) {
    this.verificationService = verificationService || new EbayDetailVerificationService();
    this.notificationService = notificationService || new NotificationService();
    this.batchProcessor = batchProcessor || new VerificationBatchProcessor(this.verificationService);
  }

  /**
   * 未検証商品の一括処理と通知
   */
  async processPendingVerificationsWithNotification(options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    sendNotifications?: boolean;
  } = {}): Promise<{
    verificationResult: {
      totalProcessed: number;
      successful: number;
      failed: number;
      summary: {
        sold: number;
        deleted: number; // 削除された商品数（売れていなかった商品）
        errors: number;
      };
      soldProductIds: string[]; // 検証で確定した売上商品のIDリスト
    };
    notificationResult: {
      notificationsSent: number;
      errors: string[];
    };
  }> {
    const {
      batchSize = 10,
      delayBetweenBatches = 2000,
      sendNotifications = true
    } = options;

    console.log('🔄 検証と通知の統合処理を開始します...');

    // 1. 未検証商品の一括処理
    const verificationResult = await this.batchProcessor.processPendingVerifications({
      batchSize,
      delayBetweenBatches
    });

    console.log('📊 検証処理完了:', verificationResult);

    // 2. 売上確認された商品の通知
    const notificationResult = {
      notificationsSent: 0,
      errors: [] as string[]
    };

    if (sendNotifications && verificationResult.summary.sold > 0) {
      console.log('📧 売上通知を送信します...');
      
      // 検証で確定した売上商品IDリストを使用して通知を送信
      if (verificationResult.soldProductIds && verificationResult.soldProductIds.length > 0) {
        try {
          const result = await this.notificationService.notifyVerifiedSoldProducts(
            verificationResult.soldProductIds
          );
          notificationResult.notificationsSent = result.notificationsSent;
          notificationResult.errors = result.errors;
        } catch (error) {
          notificationResult.errors.push(
            `通知送信エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      } else {
        // フォールバック: 従来の方法で通知を送信（後方互換性のため）
        const storesWithSales = await prisma.product.findMany({
          where: {
            verificationStatus: VerificationStatus.SOLD_CONFIRMED,
            status: ProductStatus.SOLD,
            soldAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 過去24時間以内
            }
          },
          select: {
            storeId: true
          },
          distinct: ['storeId']
        });

        // 各ストアに対して通知を送信
        for (const store of storesWithSales) {
          try {
            const result = await this.notificationService.notifyVerifiedSales(store.storeId);
            notificationResult.notificationsSent += result.notificationsSent;
            notificationResult.errors.push(...result.errors);
          } catch (error) {
            notificationResult.errors.push(
              `Store ${store.storeId}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }

      console.log('📧 通知送信完了:', notificationResult);
    }

    return {
      verificationResult,
      notificationResult
    };
  }

  /**
   * 特定のストアの検証と通知
   */
  async verifyStoreWithNotification(storeId: string): Promise<{
    verificationResult: {
      processed: number;
      successful: number;
      failed: number;
    };
    notificationResult: {
      notificationsSent: number;
      errors: string[];
    };
  }> {
    console.log(`🔍 ストア ${storeId} の検証と通知を開始します...`);

    // 1. ストアの未検証商品を検証
    const pendingProducts = await prisma.product.findMany({
      where: {
        storeId,
        verificationStatus: VerificationStatus.PENDING
      },
      select: {
        id: true
      }
    });

    let verificationResult = {
      processed: 0,
      successful: 0,
      failed: 0
    };

    if (pendingProducts.length > 0) {
      const results = await this.verificationService.verifyMultipleProducts(
        pendingProducts.map(p => p.id)
      );

      verificationResult = {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      };
    }

    // 2. 売上通知を送信
    const notificationResult = await this.notificationService.notifyVerifiedSales(storeId);

    console.log(`✅ ストア ${storeId} の処理完了:`, {
      verification: verificationResult,
      notification: notificationResult
    });

    return {
      verificationResult,
      notificationResult
    };
  }

  /**
   * 検証統計と通知統計の取得
   */
  async getCombinedStats(): Promise<{
    verification: {
      total: number;
      pending: number;
      verified: number;
      soldConfirmed: number;
      deleted: number; // 削除された商品数
      error: number;
    };
    notification: {
      total: number;
      pending: number;
      sent: number;
      failed: number;
    };
  }> {
    const [verificationStats, notificationStats] = await Promise.all([
      this.verificationService.getVerificationStats(),
      this.notificationService.getNotificationStats()
    ]);

    return {
      verification: verificationStats,
      notification: notificationStats
    };
  }

  /**
   * 失敗した処理の再試行
   */
  async retryFailedOperations(): Promise<{
    verificationRetry: {
      processed: number;
      successful: number;
      failed: number;
    };
    notificationRetry: {
      processed: number;
      successful: number;
      failed: number;
    };
  }> {
    console.log('🔄 失敗した処理の再試行を開始します...');

    // 1. 検証エラーの再試行
    const verificationRetryResult = await this.batchProcessor.retryFailedVerifications({
      batchSize: 5
    });
    
    const verificationRetry = {
      processed: verificationRetryResult.totalProcessed,
      successful: verificationRetryResult.successful,
      failed: verificationRetryResult.failed
    };

    // 2. 通知エラーの再試行
    const notificationRetry = await this.notificationService.retryFailedNotifications(10);

    console.log('🔄 再試行完了:', {
      verification: verificationRetry,
      notification: notificationRetry
    });

    return {
      verificationRetry,
      notificationRetry
    };
  }

  /**
   * システム全体のヘルスチェック
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    stats: {
      verification: {
        total: number;
        pending: number;
        verified: number;
        soldConfirmed: number;
        deleted: number; // 削除された商品数
        error: number;
      };
      notification: {
        total: number;
        pending: number;
        sent: number;
        failed: number;
      };
    };
  }> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'error' = 'healthy';

    try {
      const stats = await this.getCombinedStats();

      // 検証関連のチェック
      if (stats.verification.pending > 100) {
        issues.push(`未検証商品が多すぎます (${stats.verification.pending}件)`);
        status = 'warning';
      }

      if (stats.verification.error > 50) {
        issues.push(`検証エラーが多すぎます (${stats.verification.error}件)`);
        status = 'error';
      }

      // 通知関連のチェック
      if (stats.notification.failed > 10) {
        issues.push(`通知エラーが多すぎます (${stats.notification.failed}件)`);
        status = status === 'error' ? 'error' : 'warning';
      }

      if (stats.notification.pending > 20) {
        issues.push(`送信待ちの通知が多すぎます (${stats.notification.pending}件)`);
        status = status === 'error' ? 'error' : 'warning';
      }

      return {
        status,
        issues,
        stats
      };
    } catch (error) {
      return {
        status: 'error',
        issues: [`ヘルスチェック中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`],
        stats: {
          verification: {
            total: 0,
            pending: 0,
            verified: 0,
            soldConfirmed: 0,
            deleted: 0, // 削除された商品数
            error: 0
          },
          notification: {
            total: 0,
            pending: 0,
            sent: 0,
            failed: 0
          }
        }
      };
    }
  }
}

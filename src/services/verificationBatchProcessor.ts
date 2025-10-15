import { EbayDetailVerificationService } from './ebayDetailVerificationService';
import { prisma } from '@/lib/prisma';
import { VerificationStatus } from '@prisma/client';

/**
 * 検証バッチ処理サービス
 * 未検証商品の一括確認と処理を行う
 */
export class VerificationBatchProcessor {
  private verificationService: EbayDetailVerificationService;

  constructor(verificationService?: EbayDetailVerificationService) {
    this.verificationService = verificationService || new EbayDetailVerificationService();
  }

  /**
   * 未検証商品の一括処理
   */
  async processPendingVerifications(options: {
    batchSize?: number;
    maxRetries?: number;
    delayBetweenBatches?: number;
  } = {}): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    summary: {
      sold: number;
      outOfStock: number;
      listingEnded: number;
      verified: number;
      errors: number;
    };
  }> {
    const {
      batchSize = 10,
      delayBetweenBatches = 2000 // 2秒
    } = options;

    let totalProcessed = 0;
    let successful = 0;
    let failed = 0;
    const summary = {
      sold: 0,
      outOfStock: 0,
      listingEnded: 0,
      verified: 0,
      errors: 0
    };

    console.log('🔍 最新の売れた商品の検証を開始します...');

    while (true) {
      // 最新の売れた商品（REMOVEDステータス + PENDING状態）のみを取得
      // 最新のクロール（1時間以内）で検出された商品のみを対象にする
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const pendingProducts = await prisma.product.findMany({
        where: {
          verificationStatus: VerificationStatus.PENDING,
          status: 'REMOVED', // 売れた商品のみ
          lastSeenAt: {
            gte: oneHourAgo // 1時間以内に検出された商品のみ
          }
        },
        take: batchSize,
        orderBy: {
          lastSeenAt: 'desc'
        }
      });

      if (pendingProducts.length === 0) {
        console.log('✅ 最新の売れた商品の検証対象がありません。処理完了。');
        break;
      }

      console.log(`📦 最新の売れた商品を検証中: ${pendingProducts.length}件`);

      // バッチ処理実行
      const results = await this.verificationService.verifyMultipleProducts(
        pendingProducts.map(p => p.id)
      );

      // 結果を集計
      for (const result of results) {
        totalProcessed++;
        
        if (result.success && result.verificationResult) {
          successful++;
          
          // 検証結果に基づいて集計
          if (result.verificationResult.isSold) {
            summary.sold++;
          } else if (result.verificationResult.isOutOfStock) {
            summary.outOfStock++;
          } else if (result.verificationResult.isListingEnded) {
            summary.listingEnded++;
          } else {
            summary.verified++;
          }
        } else {
          failed++;
          summary.errors++;
          console.log(`❌ 商品 ${result.productId} の検証に失敗: ${result.error}`);
        }
      }

      console.log(`📊 バッチ完了: 成功 ${results.filter(r => r.success).length}件, 失敗 ${results.filter(r => !r.success).length}件`);

      // 次のバッチまでの待機
      if (delayBetweenBatches > 0) {
        console.log(`⏳ ${delayBetweenBatches}ms 待機中...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log('🎉 最新の売れた商品の検証完了!');
    console.log(`📈 検証結果:`);
    console.log(`   総処理数: ${totalProcessed}件`);
    console.log(`   成功: ${successful}件`);
    console.log(`   失敗: ${failed}件`);
    console.log(`   売上確認: ${summary.sold}件`);
    console.log(`   在庫切れ: ${summary.outOfStock}件`);
    console.log(`   出品終了: ${summary.listingEnded}件`);
    console.log(`   検証済み: ${summary.verified}件`);
    console.log(`   エラー: ${summary.errors}件`);

    return {
      totalProcessed,
      successful,
      failed,
      summary
    };
  }

  /**
   * エラー状態の商品を再処理
   */
  async retryFailedVerifications(options: {
    batchSize?: number;
    maxAge?: number; // 時間（ミリ秒）
  } = {}): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
  }> {
    const {
      batchSize = 5,
      maxAge = 24 * 60 * 60 * 1000 // 24時間
    } = options;

    const cutoffTime = new Date(Date.now() - maxAge);

    // エラー状態の商品を取得（指定時間より古いもの）
    const failedProducts = await prisma.product.findMany({
      where: {
        verificationStatus: VerificationStatus.ERROR,
        lastVerifiedAt: {
          lt: cutoffTime
        }
      },
      take: batchSize,
      orderBy: {
        lastVerifiedAt: 'asc'
      }
    });

    if (failedProducts.length === 0) {
      console.log('🔄 再処理対象のエラー商品がありません。');
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0
      };
    }

    console.log(`🔄 ${failedProducts.length}件のエラー商品を再処理します...`);

    const results = await this.verificationService.verifyMultipleProducts(
      failedProducts.map(p => p.id)
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`🔄 再処理完了: 成功 ${successful}件, 失敗 ${failed}件`);

    return {
      totalProcessed: results.length,
      successful,
      failed
    };
  }

  /**
   * 検証統計の表示
   */
  async displayVerificationStats(): Promise<void> {
    const stats = await this.verificationService.getVerificationStats();
    
    console.log('📊 検証統計:');
    console.log(`   総商品数: ${stats.total}件`);
    console.log(`   未検証: ${stats.pending}件`);
    console.log(`   検証済み: ${stats.verified}件`);
    console.log(`   売上確認済み: ${stats.soldConfirmed}件`);
    console.log(`   在庫切れ: ${stats.outOfStock}件`);
    console.log(`   出品終了: ${stats.listingEnded}件`);
    console.log(`   エラー: ${stats.error}件`);
  }

  /**
   * 古い検証データのクリーンアップ
   */
  async cleanupOldVerifications(options: {
    maxAge?: number; // 時間（ミリ秒）
    dryRun?: boolean;
  } = {}): Promise<{
    deletedCount: number;
  }> {
    const {
      maxAge = 30 * 24 * 60 * 60 * 1000, // 30日
      dryRun = true
    } = options;

    const cutoffTime = new Date(Date.now() - maxAge);

    // 古い検証済み商品を取得
    const oldProducts = await prisma.product.findMany({
      where: {
        verificationStatus: {
          in: [
            VerificationStatus.VERIFIED,
            VerificationStatus.OUT_OF_STOCK,
            VerificationStatus.LISTING_ENDED
          ]
        },
        lastVerifiedAt: {
          lt: cutoffTime
        }
      },
      select: {
        id: true,
        title: true,
        lastVerifiedAt: true
      }
    });

    if (oldProducts.length === 0) {
      console.log('🧹 クリーンアップ対象の古い検証データがありません。');
      return { deletedCount: 0 };
    }

    console.log(`🧹 ${oldProducts.length}件の古い検証データが見つかりました。`);

    if (dryRun) {
      console.log('🔍 ドライランモード: 実際の削除は行いません。');
      oldProducts.forEach(product => {
        console.log(`   - ${product.title} (最終検証: ${product.lastVerifiedAt})`);
      });
      return { deletedCount: 0 };
    }

    // 実際の削除
    const deleteResult = await prisma.product.deleteMany({
      where: {
        id: {
          in: oldProducts.map(p => p.id)
        }
      }
    });

    console.log(`🗑️  ${deleteResult.count}件の古い検証データを削除しました。`);

    return { deletedCount: deleteResult.count };
  }
}

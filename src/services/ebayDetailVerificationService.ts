import { prisma } from '@/lib/prisma';
import { EbayApiClient } from './ebayApiClient';
import { EbayResponseParser } from './ebayResponseParser';
import { EbayVerificationResult } from '@/types/ebay-api';
import { VerificationStatus, Product, ProductStatus } from '@prisma/client';

/**
 * eBay詳細確認サービス
 * 商品が一覧から消えた際の詳細確認と売上判定を行う
 */
export class EbayDetailVerificationService {
  private apiClient: EbayApiClient;
  private responseParser: EbayResponseParser;

  constructor(apiClient?: EbayApiClient, responseParser?: EbayResponseParser) {
    this.apiClient = apiClient || new EbayApiClient();
    this.responseParser = responseParser || new EbayResponseParser();
  }

  /**
   * 単一商品の詳細確認
   */
  async verifyProduct(product: Pick<Product, 'ebayItemId'>): Promise<EbayVerificationResult> {
    try {
      // eBay APIから商品詳細を取得
      const apiResponse = await this.apiClient.getProductDetails(product.ebayItemId);
      
      // レスポンスを解析
      const productDetails = this.responseParser.parseProductDetails(product.ebayItemId, apiResponse);
      
      // 売上判定
      const statusAnalysis = this.responseParser.analyzeProductStatus(productDetails);

      return {
        success: true,
        productDetails,
        isSold: statusAnalysis.isSold,
        isOutOfStock: statusAnalysis.isOutOfStock,
        isListingEnded: statusAnalysis.isListingEnded
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        error: {
          error: 'VERIFICATION_FAILED',
          message: errorMessage
        },
        isSold: false,
        isOutOfStock: false,
        isListingEnded: false
      };
    }
  }

  /**
   * データベースの商品を検証して更新
   */
  async verifyAndUpdateProduct(productId: string): Promise<{
    success: boolean;
    verificationResult?: EbayVerificationResult;
    updatedProduct?: Product | null;
    error?: string;
  }> {
    try {
      // 商品情報を取得
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!product) {
        return {
          success: false,
          error: 'Product not found'
        };
      }

      // eBay APIで詳細確認
      const verificationResult = await this.verifyProduct(product);

      if (!verificationResult.success) {
        // エラーの場合は検証ステータスを更新
        await prisma.product.update({
          where: { id: productId },
          data: {
            verificationStatus: VerificationStatus.ERROR,
            verificationError: verificationResult.error?.message || 'Unknown error',
            lastVerifiedAt: new Date()
          }
        });

        return {
          success: false,
          verificationResult,
          error: verificationResult.error?.message
        };
      }

      // 検証結果に基づいて処理を決定
      if (verificationResult.isSold) {
        // 売れたことが確定した場合：SOLDステータスに更新
        const updatedProduct = await prisma.product.update({
          where: { id: productId },
          data: {
            verificationStatus: VerificationStatus.SOLD_CONFIRMED,
            status: ProductStatus.SOLD,
            lastSoldQuantity: verificationResult.productDetails?.soldQuantity,
            lastAvailableQuantity: verificationResult.productDetails?.availableQuantity,
            lastRemainingQuantity: verificationResult.productDetails?.remainingQuantity,
            lastVerifiedAt: new Date(),
            verificationError: null,
            soldAt: new Date()
          }
        });

        return {
          success: true,
          verificationResult,
          updatedProduct
        };
      } else {
        // 売れていない場合：DBから削除
        console.log(`🗑️  商品「${product.title}」は売れていませんでした。DBから削除します。`);
        
        await prisma.product.delete({
          where: { id: productId }
        });

        return {
          success: true,
          verificationResult,
          updatedProduct: null // 削除されたためnull
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 複数商品の一括検証
   */
  async verifyMultipleProducts(productIds: string[]): Promise<Array<{
    productId: string;
    success: boolean;
    verificationResult?: EbayVerificationResult;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      productIds.map(async (productId) => {
        const result = await this.verifyAndUpdateProduct(productId);
        return {
          productId,
          success: result.success,
          verificationResult: result.verificationResult,
          error: result.error
        };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          productId: productIds[index],
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * 未検証商品の一括検証
   */
  async verifyPendingProducts(limit: number = 10): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: Array<{
      productId: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    // 未検証の商品を取得
    const pendingProducts = await prisma.product.findMany({
      where: {
        verificationStatus: VerificationStatus.PENDING
      },
      take: limit,
      orderBy: {
        lastSeenAt: 'desc'
      }
    });

    if (pendingProducts.length === 0) {
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }

    const productIds = pendingProducts.map(p => p.id);
    const results = await this.verifyMultipleProducts(productIds);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      processed: results.length,
      successful,
      failed,
      results: results.map(r => ({
        productId: r.productId,
        success: r.success,
        error: r.error
      }))
    };
  }

  /**
   * 検証統計の取得
   */
  async getVerificationStats(): Promise<{
    total: number;
    pending: number;
    verified: number;
    soldConfirmed: number;
    deleted: number; // 削除された商品数
    error: number;
  }> {
    const stats = await prisma.product.groupBy({
      by: ['verificationStatus'],
      _count: {
        id: true
      }
    });

    const result = {
      total: 0,
      pending: 0,
      verified: 0,
      soldConfirmed: 0,
      deleted: 0, // 削除された商品数（実際にはDBに存在しないので常に0）
      error: 0
    };

    stats.forEach(stat => {
      const count = stat._count.id;
      result.total += count;

      switch (stat.verificationStatus) {
        case VerificationStatus.PENDING:
          result.pending = count;
          break;
        case VerificationStatus.VERIFIED:
          result.verified = count;
          break;
        case VerificationStatus.SOLD_CONFIRMED:
          result.soldConfirmed = count;
          break;
        // OUT_OF_STOCK と LISTING_ENDED は削除されるため、deleted として扱わない
        // これらのステータスは新しい仕様では存在しない
        case VerificationStatus.ERROR:
          result.error = count;
          break;
      }
    });

    return result;
  }
}

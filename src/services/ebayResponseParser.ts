import { EbayApiResponse, EbayProductDetails } from '@/types/ebay-api';

/**
 * eBay APIレスポンス解析サービス
 * ユニットテスト可能な設計
 */
export class EbayResponseParser {
  /**
   * eBay APIレスポンスから商品詳細情報を抽出
   */
  parseProductDetails(itemId: string, response: EbayApiResponse): EbayProductDetails {
    try {
      const vls = response.modules?.VLS;
      if (!vls) {
        throw new Error('VLS module not found in response');
      }

      const listing = vls.listing;
      if (!listing) {
        throw new Error('Listing not found in VLS module');
      }

      const itemVariations = listing.itemVariations;
      if (!itemVariations || itemVariations.length === 0) {
        throw new Error('Item variations not found');
      }

      // 最初のバリエーションの数量情報を取得
      const firstVariation = itemVariations[0];
      const quantityInfo = firstVariation.quantityAndAvailabilityByLogisticsPlans;
      
      if (!quantityInfo || quantityInfo.length === 0) {
        throw new Error('Quantity and availability information not found');
      }

      const quantityData = quantityInfo[0].quantityAndAvailability;
      
      const availableQuantity = quantityData.availableQuantity || 0;
      const soldQuantity = quantityData.soldQuantity || 0;
      const remainingQuantity = quantityData.remainingQuantity || 0;
      const availabilityStatus = quantityData.availabilityStatus || 'UNKNOWN';

      return {
        itemId,
        availabilityStatus,
        availableQuantity,
        soldQuantity,
        remainingQuantity,
        isAvailable: availabilityStatus === 'IN_STOCK',
        isSoldOut: availabilityStatus === 'OUT_OF_STOCK',
        hasStock: remainingQuantity > 0
      };
    } catch (error) {
      throw new Error(`Failed to parse product details for item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 商品詳細情報から売上判定を行う
   */
  analyzeProductStatus(productDetails: EbayProductDetails): {
    isSold: boolean;
    isOutOfStock: boolean;
    isListingEnded: boolean;
    reason: string;
  } {
    const { availabilityStatus, availableQuantity, soldQuantity, remainingQuantity } = productDetails;

    // 出品終了判定（最優先）
    if (availabilityStatus === 'ENDED' || availabilityStatus === 'COMPLETED') {
      return {
        isSold: false,
        isOutOfStock: false,
        isListingEnded: true,
        reason: '出品が終了しました'
      };
    }

    // 売上判定（在庫が完全に0の場合のみ）
    if (availableQuantity === 0 && remainingQuantity === 0 && soldQuantity > 0) {
      return {
        isSold: true,
        isOutOfStock: false,
        isListingEnded: false,
        reason: `商品が売れました (売上数量: ${soldQuantity}, 在庫: 0)`
      };
    }

    // 在庫切れ判定（一時的な在庫切れ）
    if (availabilityStatus === 'OUT_OF_STOCK' || (availableQuantity === 0 && remainingQuantity === 0)) {
      return {
        isSold: false,
        isOutOfStock: true,
        isListingEnded: false,
        reason: '在庫切れのため商品が非表示になっています'
      };
    }

    // 販売中（在庫あり）
    if (availableQuantity > 0 || remainingQuantity > 0) {
      return {
        isSold: false,
        isOutOfStock: false,
        isListingEnded: false,
        reason: `販売中 (利用可能: ${availableQuantity}, 残り: ${remainingQuantity}, 売上: ${soldQuantity})`
      };
    }

    // その他の場合
    return {
      isSold: false,
      isOutOfStock: false,
      isListingEnded: false,
      reason: `不明な状態 (ステータス: ${availabilityStatus}, 利用可能: ${availableQuantity}, 残り: ${remainingQuantity})`
    };
  }

  /**
   * 前回のデータと比較して変化を検出
   */
  detectChanges(
    currentDetails: EbayProductDetails,
    previousDetails?: {
      soldQuantity: number;
      availableQuantity: number;
      remainingQuantity: number;
    }
  ): {
    hasChanges: boolean;
    changes: string[];
  } {
    const changes: string[] = [];

    if (!previousDetails) {
      return {
        hasChanges: true,
        changes: ['初回確認']
      };
    }

    // 売上数量の変化
    if (currentDetails.soldQuantity !== previousDetails.soldQuantity) {
      const diff = currentDetails.soldQuantity - previousDetails.soldQuantity;
      if (diff > 0) {
        changes.push(`売上数量が${diff}件増加 (${previousDetails.soldQuantity} → ${currentDetails.soldQuantity})`);
      } else {
        changes.push(`売上数量が${Math.abs(diff)}件減少 (${previousDetails.soldQuantity} → ${currentDetails.soldQuantity})`);
      }
    }

    // 在庫数量の変化
    if (currentDetails.availableQuantity !== previousDetails.availableQuantity) {
      const diff = currentDetails.availableQuantity - previousDetails.availableQuantity;
      if (diff > 0) {
        changes.push(`在庫数量が${diff}件増加 (${previousDetails.availableQuantity} → ${currentDetails.availableQuantity})`);
      } else {
        changes.push(`在庫数量が${Math.abs(diff)}件減少 (${previousDetails.availableQuantity} → ${currentDetails.availableQuantity})`);
      }
    }

    // 残り数量の変化
    if (currentDetails.remainingQuantity !== previousDetails.remainingQuantity) {
      const diff = currentDetails.remainingQuantity - previousDetails.remainingQuantity;
      if (diff > 0) {
        changes.push(`残り数量が${diff}件増加 (${previousDetails.remainingQuantity} → ${currentDetails.remainingQuantity})`);
      } else {
        changes.push(`残り数量が${Math.abs(diff)}件減少 (${previousDetails.remainingQuantity} → ${currentDetails.remainingQuantity})`);
      }
    }

    return {
      hasChanges: changes.length > 0,
      changes
    };
  }
}

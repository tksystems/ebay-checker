import { EbayResponseParser } from '../../services/ebayResponseParser';
import { EbayApiResponse, EbayProductDetails } from '../../types/ebay-api';

describe('EbayResponseParser', () => {
  let parser: EbayResponseParser;

  beforeEach(() => {
    parser = new EbayResponseParser();
  });

  describe('parseProductDetails', () => {
    const mockItemId = '336041668545';

    it('正常なレスポンスを解析する', () => {
      const mockResponse: EbayApiResponse = {
        modules: {
          VLS: {
            listing: {
              itemVariations: [
                {
                  quantityAndAvailabilityByLogisticsPlans: [
                    {
                      quantityAndAvailability: {
                        availabilityStatus: 'OUT_OF_STOCK',
                        availableQuantity: 0,
                        soldQuantity: 1,
                        remainingQuantity: 0
                      }
                    }
                  ]
                }
              ]
            }
          }
        }
      };

      const result = parser.parseProductDetails(mockItemId, mockResponse);

      expect(result).toEqual({
        itemId: '336041668545',
        availabilityStatus: 'OUT_OF_STOCK',
        availableQuantity: 0,
        soldQuantity: 1,
        remainingQuantity: 0,
        isAvailable: false,
        isSoldOut: true,
        hasStock: false
      });
    });

    it('在庫ありの商品を解析する', () => {
      const mockResponse: EbayApiResponse = {
        modules: {
          VLS: {
            listing: {
              itemVariations: [
                {
                  quantityAndAvailabilityByLogisticsPlans: [
                    {
                      quantityAndAvailability: {
                        availabilityStatus: 'IN_STOCK',
                        availableQuantity: 5,
                        soldQuantity: 0,
                        remainingQuantity: 5
                      }
                    }
                  ]
                }
              ]
            }
          }
        }
      };

      const result = parser.parseProductDetails(mockItemId, mockResponse);

      expect(result).toEqual({
        itemId: '336041668545',
        availabilityStatus: 'IN_STOCK',
        availableQuantity: 5,
        soldQuantity: 0,
        remainingQuantity: 5,
        isAvailable: true,
        isSoldOut: false,
        hasStock: true
      });
    });

    it('VLSモジュールが存在しない場合はエラーを投げる', () => {
      const mockResponse = {
        modules: {}
      } as Partial<EbayApiResponse>;

      expect(() => parser.parseProductDetails(mockItemId, mockResponse)).toThrow(
        'Failed to parse product details for item 336041668545: VLS module not found in response'
      );
    });

    it('listingが存在しない場合はエラーを投げる', () => {
      const mockResponse = {
        modules: {
          VLS: {}
        }
      } as Partial<EbayApiResponse>;

      expect(() => parser.parseProductDetails(mockItemId, mockResponse)).toThrow(
        'Failed to parse product details for item 336041668545: Listing not found in VLS module'
      );
    });

    it('itemVariationsが存在しない場合はエラーを投げる', () => {
      const mockResponse = {
        modules: {
          VLS: {
            listing: {}
          }
        }
      } as Partial<EbayApiResponse>;

      expect(() => parser.parseProductDetails(mockItemId, mockResponse)).toThrow(
        'Failed to parse product details for item 336041668545: Item variations not found'
      );
    });

    it('数量情報が存在しない場合はエラーを投げる', () => {
      const mockResponse = {
        modules: {
          VLS: {
            listing: {
              itemVariations: [{}]
            }
          }
        }
      } as Partial<EbayApiResponse>;

      expect(() => parser.parseProductDetails(mockItemId, mockResponse)).toThrow(
        'Failed to parse product details for item 336041668545: Quantity and availability information not found'
      );
    });
  });

  describe('analyzeProductStatus', () => {
    it('売上確認済みの商品を判定する', () => {
      const productDetails: EbayProductDetails = {
        itemId: '336041668545',
        availabilityStatus: 'OUT_OF_STOCK',
        availableQuantity: 0,
        soldQuantity: 1,
        remainingQuantity: 0,
        isAvailable: false,
        isSoldOut: true,
        hasStock: false
      };

      const result = parser.analyzeProductStatus(productDetails);

      expect(result).toEqual({
        isSold: true,
        isOutOfStock: false,
        isListingEnded: false,
        reason: '商品が売れました (売上数量: 1)'
      });
    });

    it('在庫切れの商品を判定する', () => {
      const productDetails: EbayProductDetails = {
        itemId: '336041668545',
        availabilityStatus: 'OUT_OF_STOCK',
        availableQuantity: 0,
        soldQuantity: 0,
        remainingQuantity: 0,
        isAvailable: false,
        isSoldOut: true,
        hasStock: false
      };

      const result = parser.analyzeProductStatus(productDetails);

      expect(result).toEqual({
        isSold: false,
        isOutOfStock: true,
        isListingEnded: false,
        reason: '在庫切れのため商品が非表示になっています'
      });
    });

    it('出品終了の商品を判定する', () => {
      const productDetails: EbayProductDetails = {
        itemId: '336041668545',
        availabilityStatus: 'ENDED',
        availableQuantity: 0,
        soldQuantity: 0,
        remainingQuantity: 0,
        isAvailable: false,
        isSoldOut: false,
        hasStock: false
      };

      const result = parser.analyzeProductStatus(productDetails);

      expect(result).toEqual({
        isSold: false,
        isOutOfStock: false,
        isListingEnded: true,
        reason: '出品が終了しました'
      });
    });

    it('その他のステータスの商品を判定する', () => {
      const productDetails: EbayProductDetails = {
        itemId: '336041668545',
        availabilityStatus: 'UNKNOWN',
        availableQuantity: 0,
        soldQuantity: 0,
        remainingQuantity: 0,
        isAvailable: false,
        isSoldOut: false,
        hasStock: false
      };

      const result = parser.analyzeProductStatus(productDetails);

      expect(result).toEqual({
        isSold: false,
        isOutOfStock: false,
        isListingEnded: false,
        reason: '一時的な非表示 (ステータス: UNKNOWN)'
      });
    });
  });

  describe('detectChanges', () => {
    const currentDetails: EbayProductDetails = {
      itemId: '336041668545',
      availabilityStatus: 'OUT_OF_STOCK',
      availableQuantity: 0,
      soldQuantity: 2,
      remainingQuantity: 0,
      isAvailable: false,
      isSoldOut: true,
      hasStock: false
    };

    it('前回データがない場合は初回確認として判定する', () => {
      const result = parser.detectChanges(currentDetails);

      expect(result).toEqual({
        hasChanges: true,
        changes: ['初回確認']
      });
    });

    it('売上数量の変化を検出する', () => {
      const previousDetails = {
        soldQuantity: 1,
        availableQuantity: 0,
        remainingQuantity: 0
      };

      const result = parser.detectChanges(currentDetails, previousDetails);

      expect(result).toEqual({
        hasChanges: true,
        changes: ['売上数量が1件増加 (1 → 2)']
      });
    });

    it('在庫数量の変化を検出する', () => {
      const previousDetails = {
        soldQuantity: 2,
        availableQuantity: 5,
        remainingQuantity: 5
      };

      const result = parser.detectChanges(currentDetails, previousDetails);

      expect(result).toEqual({
        hasChanges: true,
        changes: ['在庫数量が5件減少 (5 → 0)']
      });
    });

    it('残り数量の変化を検出する', () => {
      const previousDetails = {
        soldQuantity: 2,
        availableQuantity: 0,
        remainingQuantity: 3
      };

      const result = parser.detectChanges(currentDetails, previousDetails);

      expect(result).toEqual({
        hasChanges: true,
        changes: ['残り数量が3件減少 (3 → 0)']
      });
    });

    it('複数の変化を検出する', () => {
      const previousDetails = {
        soldQuantity: 1,
        availableQuantity: 5,
        remainingQuantity: 3
      };

      const result = parser.detectChanges(currentDetails, previousDetails);

      expect(result).toEqual({
        hasChanges: true,
        changes: [
          '売上数量が1件増加 (1 → 2)',
          '在庫数量が5件減少 (5 → 0)',
          '残り数量が3件減少 (3 → 0)'
        ]
      });
    });

    it('変化がない場合は空の配列を返す', () => {
      const previousDetails = {
        soldQuantity: 2,
        availableQuantity: 0,
        remainingQuantity: 0
      };

      const result = parser.detectChanges(currentDetails, previousDetails);

      expect(result).toEqual({
        hasChanges: false,
        changes: []
      });
    });
  });
});

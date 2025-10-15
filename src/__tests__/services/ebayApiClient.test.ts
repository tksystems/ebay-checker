import { EbayApiClient } from '../../services/ebayApiClient';
import { EbayApiResponse } from '../../types/ebay-api';

// fetch のモック
global.fetch = jest.fn();

describe('EbayApiClient', () => {
  let apiClient: EbayApiClient;
  const mockAuthorization = 'test-auth-token';

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = new EbayApiClient(mockAuthorization);
  });

  describe('constructor', () => {
    it('認証トークンが設定される', () => {
      expect(apiClient).toBeDefined();
    });

    it('認証トークンが未設定の場合はエラーを投げる', () => {
      expect(() => new EbayApiClient('')).toThrow('EBAY_API_AUTHORIZATION is required');
    });
  });

  describe('getProductDetails', () => {
    const mockItemId = '336041668545';
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

    it('正常なレスポンスを返す', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await apiClient.getProductDetails(mockItemId);

      expect(fetch).toHaveBeenCalledWith(
        `https://apisd.ebay.com/experience/listing_details/v2/view_item?itemId=${mockItemId}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAuthorization}`,
            'Host': 'apisd.ebay.com',
            'User-Agent': 'eBayiPhone/6.227.1'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('HTTPエラーの場合はエラーを投げる', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      });

      await expect(apiClient.getProductDetails(mockItemId)).rejects.toThrow(
        'Failed to fetch product details for item 336041668545: HTTP 404: Not Found'
      );
    });

    it('ネットワークエラーの場合はエラーを投げる', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.getProductDetails(mockItemId)).rejects.toThrow(
        'Failed to fetch product details for item 336041668545: Network error'
      );
    });

    it('タイムアウトが設定される', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await apiClient.getProductDetails(mockItemId);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  describe('getMultipleProductDetails', () => {
    const mockItemIds = ['336041668545', '336041668546'];
    const mockResponse1: EbayApiResponse = {
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

    const mockResponse2: EbayApiResponse = {
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

    it('複数の商品詳細を並列取得する', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2
        });

      const results = await apiClient.getMultipleProductDetails(mockItemIds);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        itemId: '336041668545',
        data: mockResponse1
      });
      expect(results[1]).toEqual({
        itemId: '336041668546',
        data: mockResponse2
      });
    });

    it('一部の商品でエラーが発生しても他の商品は処理される', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await apiClient.getMultipleProductDetails(mockItemIds);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        itemId: '336041668545',
        data: mockResponse1
      });
      expect(results[1]).toEqual({
        itemId: '336041668546',
        error: 'Failed to fetch product details for item 336041668546: Network error'
      });
    });
  });
});

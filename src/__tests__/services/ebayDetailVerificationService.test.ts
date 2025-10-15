import { EbayDetailVerificationService } from '../../services/ebayDetailVerificationService';
import { EbayApiClient } from '../../services/ebayApiClient';
import { EbayResponseParser } from '../../services/ebayResponseParser';
import { EbayVerificationResult, EbayProductDetails } from '../../types/ebay-api';
import { VerificationStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// Prismaのモック
jest.mock('../../lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn()
    }
  }
}));

describe('EbayDetailVerificationService', () => {
  let service: EbayDetailVerificationService;
  let mockApiClient: jest.Mocked<EbayApiClient>;
  let mockResponseParser: jest.Mocked<EbayResponseParser>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockApiClient = {
      getProductDetails: jest.fn(),
      getMultipleProductDetails: jest.fn()
    } as jest.Mocked<EbayApiClient>;

    mockResponseParser = {
      parseProductDetails: jest.fn(),
      analyzeProductStatus: jest.fn(),
      detectChanges: jest.fn()
    } as jest.Mocked<EbayResponseParser>;

    service = new EbayDetailVerificationService(mockApiClient, mockResponseParser);
  });

  describe('verifyProduct', () => {
    const mockItemId = '336041668545';
    const mockApiResponse = {
      modules: {
        VLS: {
          listing: {
            itemVariations: [{
              quantityAndAvailabilityByLogisticsPlans: [{
                quantityAndAvailability: {
                  availabilityStatus: 'OUT_OF_STOCK',
                  availableQuantity: 0,
                  soldQuantity: 1,
                  remainingQuantity: 0
                }
              }]
            }]
          }
        }
      }
    };

    const mockProductDetails: EbayProductDetails = {
      itemId: mockItemId,
      availabilityStatus: 'OUT_OF_STOCK',
      availableQuantity: 0,
      soldQuantity: 1,
      remainingQuantity: 0,
      isAvailable: false,
      isSoldOut: true,
      hasStock: false
    };

    it('正常な検証結果を返す', async () => {
      mockApiClient.getProductDetails.mockResolvedValueOnce(mockApiResponse);
      mockResponseParser.parseProductDetails.mockReturnValueOnce(mockProductDetails);
      mockResponseParser.analyzeProductStatus.mockReturnValueOnce({
        isSold: true,
        isOutOfStock: false,
        isListingEnded: false,
        reason: '商品が売れました'
      });

      const result = await service.verifyProduct(mockItemId);

      expect(mockApiClient.getProductDetails).toHaveBeenCalledWith(mockItemId);
      expect(mockResponseParser.parseProductDetails).toHaveBeenCalledWith(mockItemId, mockApiResponse);
      expect(mockResponseParser.analyzeProductStatus).toHaveBeenCalledWith(mockProductDetails);

      expect(result).toEqual({
        success: true,
        productDetails: mockProductDetails,
        isSold: true,
        isOutOfStock: false,
        isListingEnded: false
      });
    });

    it('APIエラーの場合は失敗結果を返す', async () => {
      const error = new Error('API Error');
      mockApiClient.getProductDetails.mockRejectedValueOnce(error);

      const result = await service.verifyProduct(mockItemId);

      expect(result).toEqual({
        success: false,
        error: {
          error: 'VERIFICATION_FAILED',
          message: 'Failed to fetch product details for item 336041668545: API Error'
        },
        isSold: false,
        isOutOfStock: false,
        isListingEnded: false
      });
    });

    it('パースエラーの場合は失敗結果を返す', async () => {
      mockApiClient.getProductDetails.mockResolvedValueOnce(mockApiResponse);
      mockResponseParser.parseProductDetails.mockImplementationOnce(() => {
        throw new Error('Parse Error');
      });

      const result = await service.verifyProduct(mockItemId);

      expect(result).toEqual({
        success: false,
        error: {
          error: 'VERIFICATION_FAILED',
          message: 'Failed to fetch product details for item 336041668545: Parse Error'
        },
        isSold: false,
        isOutOfStock: false,
        isListingEnded: false
      });
    });
  });

  describe('verifyAndUpdateProduct', () => {
    const mockProductId = 'product-123';
    const mockEbayItemId = '336041668545';
    const mockProduct = {
      id: mockProductId,
      ebayItemId: mockEbayItemId,
      status: 'ACTIVE'
    };

    const mockVerificationResult: EbayVerificationResult = {
      success: true,
      productDetails: {
        itemId: mockEbayItemId,
        availabilityStatus: 'OUT_OF_STOCK',
        availableQuantity: 0,
        soldQuantity: 1,
        remainingQuantity: 0,
        isAvailable: false,
        isSoldOut: true,
        hasStock: false
      },
      isSold: true,
      isOutOfStock: false,
      isListingEnded: false
    };

    it('正常な検証と更新を実行する', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValueOnce({ ...mockProduct, status: 'SOLD' });

      jest.spyOn(service, 'verifyProduct').mockResolvedValueOnce(mockVerificationResult);

      const result = await service.verifyAndUpdateProduct(mockProductId);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: mockProductId }
      });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProductId },
        data: {
          verificationStatus: VerificationStatus.SOLD_CONFIRMED,
          lastSoldQuantity: 1,
          lastAvailableQuantity: 0,
          lastRemainingQuantity: 0,
          lastVerifiedAt: expect.any(Date),
          verificationError: null,
          status: 'SOLD',
          soldAt: expect.any(Date)
        }
      });

      expect(result.success).toBe(true);
      expect(result.verificationResult).toEqual(mockVerificationResult);
    });

    it('商品が見つからない場合はエラーを返す', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await service.verifyAndUpdateProduct(mockProductId);

      expect(result).toEqual({
        success: false,
        error: 'Product not found'
      });
    });

    it('検証に失敗した場合はエラーステータスを更新する', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValueOnce({ ...mockProduct, verificationStatus: VerificationStatus.ERROR });

      const failedVerificationResult: EbayVerificationResult = {
        success: false,
        error: {
          error: 'VERIFICATION_FAILED',
          message: 'API Error'
        },
        isSold: false,
        isOutOfStock: false,
        isListingEnded: false
      };

      jest.spyOn(service, 'verifyProduct').mockResolvedValueOnce(failedVerificationResult);

      const result = await service.verifyAndUpdateProduct(mockProductId);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProductId },
        data: {
          verificationStatus: VerificationStatus.ERROR,
          verificationError: 'API Error',
          lastVerifiedAt: expect.any(Date)
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('verifyMultipleProducts', () => {
    const mockProductIds = ['product-1', 'product-2'];

    it('複数商品の検証を実行する', async () => {
      const mockResult1 = {
        success: true,
        verificationResult: {
          success: true,
          isSold: true,
          isOutOfStock: false,
          isListingEnded: false
        }
      };

      const mockResult2 = {
        success: false,
        error: 'Product not found'
      };

      jest.spyOn(service, 'verifyAndUpdateProduct')
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const results = await service.verifyMultipleProducts(mockProductIds);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        productId: 'product-1',
        success: true,
        verificationResult: mockResult1.verificationResult
      });
      expect(results[1]).toEqual({
        productId: 'product-2',
        success: false,
        error: 'Product not found'
      });
    });
  });

  describe('verifyPendingProducts', () => {
    it('未検証商品の一括検証を実行する', async () => {
      const mockPendingProducts = [
        { id: 'product-1' },
        { id: 'product-2' }
      ];

      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockPendingProducts);

      jest.spyOn(service, 'verifyMultipleProducts').mockResolvedValueOnce([
        { productId: 'product-1', success: true },
        { productId: 'product-2', success: false, error: 'API Error' }
      ]);

      const result = await service.verifyPendingProducts(10);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          verificationStatus: VerificationStatus.PENDING
        },
        take: 10,
        orderBy: {
          lastSeenAt: 'desc'
        }
      });

      expect(result).toEqual({
        processed: 2,
        successful: 1,
        failed: 1,
        results: [
          { productId: 'product-1', success: true },
          { productId: 'product-2', success: false, error: 'API Error' }
        ]
      });
    });

    it('未検証商品がない場合は空の結果を返す', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.verifyPendingProducts(10);

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0,
        results: []
      });
    });
  });

  describe('getVerificationStats', () => {
    it('検証統計を取得する', async () => {
      const mockStats = [
        { verificationStatus: VerificationStatus.PENDING, _count: { id: 5 } },
        { verificationStatus: VerificationStatus.VERIFIED, _count: { id: 10 } },
        { verificationStatus: VerificationStatus.SOLD_CONFIRMED, _count: { id: 3 } },
        { verificationStatus: VerificationStatus.OUT_OF_STOCK, _count: { id: 2 } },
        { verificationStatus: VerificationStatus.LISTING_ENDED, _count: { id: 1 } },
        { verificationStatus: VerificationStatus.ERROR, _count: { id: 1 } }
      ];

      (prisma.product.groupBy as jest.Mock).mockResolvedValueOnce(mockStats);

      const result = await service.getVerificationStats();

      expect(result).toEqual({
        total: 22,
        pending: 5,
        verified: 10,
        soldConfirmed: 3,
        outOfStock: 2,
        listingEnded: 1,
        error: 1
      });
    });
  });
});

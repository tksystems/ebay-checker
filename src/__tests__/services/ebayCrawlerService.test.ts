import { EbayCrawlerService } from '@/services/ebayCrawlerService'
import { ProductStatus } from '@prisma/client'

// Prismaクライアントをモック
jest.mock('@/lib/prisma', () => ({
  prisma: {
    store: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    crawlLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
    crawlStatus: {
      upsert: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

// Playwrightをモック
jest.mock('playwright-extra', () => ({
  chromium: {
    use: jest.fn(),
    launch: jest.fn(),
  },
}))

import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('EbayCrawlerService', () => {
  let ebayCrawlerService: EbayCrawlerService

  beforeEach(() => {
    ebayCrawlerService = new EbayCrawlerService()
    jest.clearAllMocks()
  })

  describe('addStore', () => {
    it('should add a new store successfully', async () => {
      const mockStore = {
        id: 'store-1',
        storeId: 'test-store',
        storeName: 'Test Store',
        storeUrl: 'https://www.ebay.com/str/test-store',
        isActive: true,
        crawlInterval: 1,
        lastCrawledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.store.create.mockResolvedValue(mockStore)

      const result = await ebayCrawlerService.addStore('test-store')

      expect(result).toBe('store-1')
      expect(mockPrisma.store.create).toHaveBeenCalledWith({
        data: {
          storeId: 'test-store',
          storeName: 'test-store',
          storeUrl: 'https://www.ebay.com/str/test-store',
          isActive: true,
          crawlInterval: 1,
        }
      })
    })

    it('should add a store with custom URL', async () => {
      const mockStore = {
        id: 'store-2',
        storeId: 'custom-store',
        storeName: 'Custom Store',
        storeUrl: 'https://custom-url.com',
        isActive: true,
        crawlInterval: 1,
        lastCrawledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.store.create.mockResolvedValue(mockStore)

      const result = await ebayCrawlerService.addStore('custom-store', 'https://custom-url.com')

      expect(result).toBe('store-2')
      expect(mockPrisma.store.create).toHaveBeenCalledWith({
        data: {
          storeId: 'custom-store',
          storeName: 'custom-store',
          storeUrl: 'https://custom-url.com',
          isActive: true,
          crawlInterval: 1,
        }
      })
    })
  })

  describe('getStores', () => {
    it('should return stores with product counts', async () => {
      const mockStores = [
        {
          id: 'store-1',
          storeName: 'Test Store 1',
          storeUrl: 'https://www.ebay.com/str/test-store-1',
          isActive: true,
          lastCrawledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { products: 10 }
        },
        {
          id: 'store-2',
          storeName: 'Test Store 2',
          storeUrl: 'https://www.ebay.com/str/test-store-2',
          isActive: false,
          lastCrawledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { products: 5 }
        }
      ]

      mockPrisma.store.findMany.mockResolvedValue(mockStores)

      const result = await ebayCrawlerService.getStores()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'store-1',
        storeName: 'Test Store 1',
        storeUrl: 'https://www.ebay.com/str/test-store-1',
        isActive: true,
        lastCrawledAt: mockStores[0].lastCrawledAt,
        productCount: 10,
        isSubscribed: false,
        subscriptionId: undefined
      })
      expect(result[1]).toEqual({
        id: 'store-2',
        storeName: 'Test Store 2',
        storeUrl: 'https://www.ebay.com/str/test-store-2',
        isActive: false,
        lastCrawledAt: null,
        productCount: 5,
        isSubscribed: false,
        subscriptionId: undefined
      })
    })
  })

  describe('getStoreProducts', () => {
    it('should return products with pagination', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          title: 'Test Product 1',
          price: 29.99,
          status: ProductStatus.ACTIVE,
          lastSeenAt: new Date(),
          soldAt: null,
        },
        {
          id: 'product-2',
          title: 'Test Product 2',
          price: 49.99,
          status: ProductStatus.SOLD,
          lastSeenAt: new Date(),
          soldAt: new Date(),
        }
      ]

      mockPrisma.product.findMany.mockResolvedValue(mockProducts)

      const result = await ebayCrawlerService.getStoreProducts('store-1', 10, 0)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'product-1',
        title: 'Test Product 1',
        price: 29.99,
        status: ProductStatus.ACTIVE,
        lastSeenAt: mockProducts[0].lastSeenAt,
        soldAt: null
      })
      expect(result[1]).toEqual({
        id: 'product-2',
        title: 'Test Product 2',
        price: 49.99,
        status: ProductStatus.SOLD,
        lastSeenAt: mockProducts[1].lastSeenAt,
        soldAt: mockProducts[1].soldAt
      })

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-1' },
        select: {
          id: true,
          title: true,
          price: true,
          status: true,
          lastSeenAt: true,
          soldAt: true,
        },
        orderBy: { lastSeenAt: 'desc' },
        take: 10,
        skip: 0
      })
    })
  })

  describe('parsePrice', () => {
    it('should parse price strings correctly', () => {
      const service = new EbayCrawlerService()
      
      // プライベートメソッドをテストするため、型アサーションを使用
      const parsePrice = (service as unknown as { parsePrice: (price: string) => number }).parsePrice.bind(service)

      expect(parsePrice('$29.99')).toBe(29.99)
      expect(parsePrice('$1,234.56')).toBe(1234.56)
      expect(parsePrice('価格不明')).toBe(0)
      expect(parsePrice('')).toBe(0)
      expect(parsePrice('$0.00')).toBe(0)
    })
  })

  describe('crawlStore', () => {
    it('should handle store not found error', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null)

      const result = await ebayCrawlerService.crawlStore('nonexistent-store')

      expect(result.success).toBe(false)
      expect(result.errorMessage).toBe('Store not found: nonexistent-store')
      expect(result.productsFound).toBe(0)
    })

    it('should handle inactive store error', async () => {
      const mockStore = {
        id: 'store-1',
        storeId: 'test-store',
        storeName: 'Test Store',
        storeUrl: 'https://www.ebay.com/str/test-store',
        isActive: false,
        crawlInterval: 1,
        lastCrawledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.store.findUnique.mockResolvedValue(mockStore)

      const result = await ebayCrawlerService.crawlStore('store-1')

      expect(result.success).toBe(false)
      expect(result.errorMessage).toBe('Store is inactive: Test Store')
    })
  })

  describe('Subscription Management', () => {
    describe('subscribeToStore', () => {
      it('should create a new subscription', async () => {
        const userId = 'user-1'
        const storeId = 'store-1'
        const mockSubscription = {
          id: 'sub-1',
          userId,
          storeId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        mockPrisma.subscription.findUnique.mockResolvedValue(null)
        mockPrisma.subscription.create.mockResolvedValue(mockSubscription)

        const result = await ebayCrawlerService.subscribeToStore(userId, storeId)

        expect(result).toBe('sub-1')
        expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
          data: {
            userId,
            storeId,
            isActive: true
          }
        })
      })

      it('should reactivate existing inactive subscription', async () => {
        const userId = 'user-1'
        const storeId = 'store-1'
        const existingSubscription = {
          id: 'sub-1',
          userId,
          storeId,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        const updatedSubscription = {
          ...existingSubscription,
          isActive: true
        }

        mockPrisma.subscription.findUnique.mockResolvedValue(existingSubscription)
        mockPrisma.subscription.update.mockResolvedValue(updatedSubscription)

        const result = await ebayCrawlerService.subscribeToStore(userId, storeId)

        expect(result).toBe('sub-1')
        expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-1' },
          data: { isActive: true }
        })
      })

      it('should throw error if already subscribed', async () => {
        const userId = 'user-1'
        const storeId = 'store-1'
        const existingSubscription = {
          id: 'sub-1',
          userId,
          storeId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        mockPrisma.subscription.findUnique.mockResolvedValue(existingSubscription)

        await expect(ebayCrawlerService.subscribeToStore(userId, storeId))
          .rejects.toThrow('既にこのストアを購読しています')
      })
    })

    describe('unsubscribeFromStore', () => {
      it('should deactivate subscription', async () => {
        const userId = 'user-1'
        const storeId = 'store-1'
        const subscription = {
          id: 'sub-1',
          userId,
          storeId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        mockPrisma.subscription.findUnique.mockResolvedValue(subscription)
        mockPrisma.subscription.update.mockResolvedValue({
          ...subscription,
          isActive: false
        })

        await ebayCrawlerService.unsubscribeFromStore(userId, storeId)

        expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-1' },
          data: { isActive: false }
        })
      })

      it('should throw error if not subscribed', async () => {
        const userId = 'user-1'
        const storeId = 'store-1'

        mockPrisma.subscription.findUnique.mockResolvedValue(null)

        await expect(ebayCrawlerService.unsubscribeFromStore(userId, storeId))
          .rejects.toThrow('このストアを購読していません')
      })
    })

    describe('getUserSubscriptions', () => {
      it('should return user subscriptions', async () => {
        const userId = 'user-1'
        const mockSubscriptions = [
          {
            id: 'sub-1',
            userId,
            storeId: 'store-1',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            store: {
              id: 'store-1',
              storeName: 'Test Store 1',
              storeUrl: 'https://www.ebay.com/str/test-store-1',
              lastCrawledAt: new Date(),
              _count: { products: 10 }
            }
          }
        ]

        mockPrisma.subscription.findMany.mockResolvedValue(mockSubscriptions)

        const result = await ebayCrawlerService.getUserSubscriptions(userId)

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
          id: 'sub-1',
          storeId: 'store-1',
          storeName: 'Test Store 1',
          storeUrl: 'https://www.ebay.com/str/test-store-1',
          isActive: true,
          productCount: 10,
          lastCrawledAt: mockSubscriptions[0].store.lastCrawledAt
        })
      })
    })
  })
})

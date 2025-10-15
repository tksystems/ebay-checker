import { NotificationService } from '../../services/notificationService';
import { NotificationType, NotificationStatus, VerificationStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// Prismaのモック
jest.mock('../../lib/prisma', () => ({
  prisma: {
    product: {
      findMany: jest.fn()
    },
    notificationSettings: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    subscription: {
      findFirst: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    notification: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn()
    }
  }
}));

// fetch のモック
global.fetch = jest.fn();

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  describe('notifyVerifiedSales', () => {
    const mockStoreId = 'store-123';
    const mockSoldProducts = [
      {
        id: 'product-1',
        title: 'Test Product 1',
        price: 1000,
        soldAt: new Date('2024-01-01T10:00:00Z'),
        store: {
          storeName: 'Test Store'
        }
      },
      {
        id: 'product-2',
        title: 'Test Product 2',
        price: 2000,
        soldAt: new Date('2024-01-01T11:00:00Z'),
        store: {
          storeName: 'Test Store'
        }
      }
    ];

    const mockNotificationSettings = [
      {
        userId: 'user-1',
        notifyOnSold: true,
        emailEnabled: true,
        user: {
          id: 'user-1',
          name: 'Test User 1'
        }
      },
      {
        userId: 'user-2',
        notifyOnSold: true,
        emailEnabled: true,
        user: {
          id: 'user-2',
          name: 'Test User 2'
        }
      }
    ];

    it('検証済み売上商品の通知を送信する', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockSoldProducts);
      (prisma.notificationSettings.findMany as jest.Mock).mockResolvedValueOnce(mockNotificationSettings);
      (prisma.subscription.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'sub-1', isActive: true })
        .mockResolvedValueOnce({ id: 'sub-2', isActive: true });
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ email: 'user1@test.com', name: 'Test User 1' })
        .mockResolvedValueOnce({ email: 'user2@test.com', name: 'Test User 2' });
      (prisma.notification.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'notif-1' })
        .mockResolvedValueOnce({ id: 'notif-2' });
      (prisma.notification.update as jest.Mock)
        .mockResolvedValueOnce({ id: 'notif-1', status: NotificationStatus.SENT })
        .mockResolvedValueOnce({ id: 'notif-2', status: NotificationStatus.SENT });

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });

      const result = await service.notifyVerifiedSales(mockStoreId);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          storeId: mockStoreId,
          verificationStatus: VerificationStatus.SOLD_CONFIRMED,
          status: 'SOLD',
          soldAt: {
            gte: expect.any(Date)
          }
        },
        include: {
          store: true
        },
        orderBy: {
          soldAt: 'desc'
        }
      });

      expect(result.notificationsSent).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('売上商品がない場合は通知を送信しない', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.notifyVerifiedSales(mockStoreId);

      expect(result.notificationsSent).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('ストアを購読していないユーザーには通知を送信しない', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockSoldProducts);
      (prisma.notificationSettings.findMany as jest.Mock).mockResolvedValueOnce(mockNotificationSettings);
      (prisma.subscription.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // 購読していない
        .mockResolvedValueOnce({ id: 'sub-2', isActive: true });

      const result = await service.notifyVerifiedSales(mockStoreId);

      expect(result.notificationsSent).toBe(1); // 1人だけ通知
    });

    it('通知送信エラーの場合はエラーを記録する', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce(mockSoldProducts);
      (prisma.notificationSettings.findMany as jest.Mock).mockResolvedValueOnce(mockNotificationSettings);
      (prisma.subscription.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'sub-1', isActive: true });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ email: 'user1@test.com', name: 'Test User 1' });
      (prisma.notification.create as jest.Mock).mockResolvedValueOnce({ id: 'notif-1' });
      (prisma.notification.update as jest.Mock).mockResolvedValueOnce({ id: 'notif-1', status: NotificationStatus.FAILED });

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server Error' });

      const result = await service.notifyVerifiedSales(mockStoreId);

      expect(result.notificationsSent).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to send email');
    });
  });

  describe('createSalesNotificationMessage', () => {
    it('売上通知メッセージを作成する', () => {
      const mockProducts = [
        {
          title: 'Test Product 1',
          price: 1000,
          soldAt: new Date('2024-01-01T10:00:00Z')
        },
        {
          title: 'Test Product 2',
          price: 2000,
          soldAt: new Date('2024-01-01T11:00:00Z')
        }
      ];

      const message = (service as unknown as { createSalesNotificationMessage: (products: unknown[], user: string) => string }).createSalesNotificationMessage(mockProducts, 'Test User');

      expect(message).toContain('Test Userさん');
      expect(message).toContain('Test Store');
      expect(message).toContain('売れた商品数: 2件');
      expect(message).toContain('Test Product 1');
      expect(message).toContain('Test Product 2');
      expect(message).toContain('¥1000');
      expect(message).toContain('¥2000');
    });

    it('多数の商品の場合はサマリーのみ表示する', () => {
      const mockProducts = Array.from({ length: 10 }, (_, i) => ({
        title: `Test Product ${i + 1}`,
        price: (i + 1) * 1000,
        soldAt: new Date(`2024-01-01T${10 + i}:00:00Z`)
      }));

      const message = (service as unknown as { createSalesNotificationMessage: (products: unknown[], user: string) => string }).createSalesNotificationMessage(mockProducts, 'Test User');

      expect(message).toContain('売れた商品数: 10件');
      expect(message).toContain('売れた商品 (最新5件)');
      expect(message).toContain('... 他5件');
    });
  });

  describe('sendNotification', () => {
    it('メール通知を送信する', async () => {
      (prisma.notification.create as jest.Mock).mockResolvedValueOnce({ id: 'notif-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ email: 'user@test.com', name: 'Test User' });
      (prisma.notification.update as jest.Mock).mockResolvedValueOnce({ id: 'notif-1', status: NotificationStatus.SENT });

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await (service as unknown as { sendNotification: (userId: string, subject: string, message: string, type: NotificationType) => Promise<void> }).sendNotification('user-1', 'Test Subject', 'Test Message', NotificationType.EMAIL);

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: NotificationType.EMAIL,
          subject: 'Test Subject',
          message: 'Test Message',
          status: NotificationStatus.PENDING
        }
      });

      expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer undefined',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'eBay Checker <noreply@ebay-checker.com>',
          to: ['user@test.com'],
          subject: 'Test Subject',
          text: 'Test Message'
        })
      });

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          status: NotificationStatus.SENT,
          sentAt: expect.any(Date)
        }
      });
    });

    it('通知送信エラーの場合は失敗ステータスを更新する', async () => {
      (prisma.notification.create as jest.Mock).mockResolvedValueOnce({ id: 'notif-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ email: 'user@test.com', name: 'Test User' });
      (prisma.notification.update as jest.Mock).mockResolvedValueOnce({ id: 'notif-1', status: NotificationStatus.FAILED });

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server Error' });

      await expect(
        (service as unknown as { sendNotification: (userId: string, subject: string, message: string, type: NotificationType) => Promise<void> }).sendNotification('user-1', 'Test Subject', 'Test Message', NotificationType.EMAIL)
      ).rejects.toThrow();

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: expect.any(String)
        }
      });
    });
  });

  describe('getNotificationStats', () => {
    it('通知統計を取得する', async () => {
      const mockStats = [
        { status: NotificationStatus.PENDING, _count: { id: 5 } },
        { status: NotificationStatus.SENT, _count: { id: 20 } },
        { status: NotificationStatus.FAILED, _count: { id: 2 } }
      ];

      (prisma.notification.groupBy as jest.Mock).mockResolvedValueOnce(mockStats);

      const result = await service.getNotificationStats();

      expect(result).toEqual({
        total: 27,
        pending: 5,
        sent: 20,
        failed: 2
      });
    });
  });

  describe('retryFailedNotifications', () => {
    it('失敗した通知の再送を実行する', async () => {
      const mockFailedNotifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: NotificationType.EMAIL,
          subject: 'Test Subject',
          message: 'Test Message',
          user: { email: 'user1@test.com' }
        },
        {
          id: 'notif-2',
          userId: 'user-2',
          type: NotificationType.EMAIL,
          subject: 'Test Subject 2',
          message: 'Test Message 2',
          user: { email: 'user2@test.com' }
        }
      ];

      (prisma.notification.findMany as jest.Mock).mockResolvedValueOnce(mockFailedNotifications);
      (prisma.notification.update as jest.Mock)
        .mockResolvedValueOnce({ id: 'notif-1', status: NotificationStatus.SENT })
        .mockResolvedValueOnce({ id: 'notif-2', status: NotificationStatus.FAILED });

      (fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server Error' });

      const result = await service.retryFailedNotifications(10);

      expect(result).toEqual({
        processed: 2,
        successful: 1,
        failed: 1
      });
    });
  });
});

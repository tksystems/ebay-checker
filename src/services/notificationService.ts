import { prisma } from '@/lib/prisma';
import { NotificationType, NotificationStatus, VerificationStatus, ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * 通知サービス
 * 検証済みの売上のみ通知する拡張版
 */
export class NotificationService {
  /**
   * 検証済み売上商品の通知
   */
  async notifyVerifiedSales(storeId: string): Promise<{
    notificationsSent: number;
    errors: string[];
  }> {
    try {
      // 検証済み売上商品を取得
      const soldProducts = await prisma.product.findMany({
        where: {
          storeId,
          verificationStatus: VerificationStatus.SOLD_CONFIRMED,
          status: ProductStatus.SOLD,
          soldAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 過去24時間以内
          }
        },
        include: {
          store: true
        },
        orderBy: {
          soldAt: 'desc'
        }
      });

      if (soldProducts.length === 0) {
        return {
          notificationsSent: 0,
          errors: []
        };
      }

      // 通知設定を取得
      const notificationSettings = await prisma.notificationSettings.findMany({
        where: {
          notifyOnSold: true,
          emailEnabled: true
        },
        include: {
          user: true
        }
      });

      let notificationsSent = 0;
      const errors: string[] = [];

      for (const setting of notificationSettings) {
        try {
          // ストアを購読しているかチェック
          const subscription = await prisma.subscription.findFirst({
            where: {
              userId: setting.userId,
              storeId,
              isActive: true
            }
          });

          if (!subscription) {
            continue; // このストアを購読していない場合はスキップ
          }

          // 通知メッセージを作成
          const subject = `💰 商品が売れました - ${soldProducts[0].store.storeName}`;
          const message = this.createSalesNotificationMessage(soldProducts, setting.user.name);

          // 通知を送信
          await this.sendNotification(
            setting.userId,
            subject,
            message,
            NotificationType.EMAIL
          );

          notificationsSent++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`User ${setting.userId}: ${errorMessage}`);
        }
      }

      return {
        notificationsSent,
        errors
      };
    } catch (error) {
      return {
        notificationsSent: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * 売上通知メッセージを作成
   */
  private createSalesNotificationMessage(products: Array<{ title: string; price: Decimal; soldAt: Date | null; store: { storeName: string } }>, userName: string): string {
    const storeName = products[0].store.storeName;
    const productCount = products.length;

    let message = `こんにちは、${userName}さん！\n\n`;
    message += `ストア「${storeName}」で商品が売れました！\n\n`;
    message += `📊 売上サマリー:\n`;
    message += `   売れた商品数: ${productCount}件\n\n`;

    if (productCount <= 5) {
      // 5件以下の場合は詳細を表示
      message += `📦 売れた商品:\n`;
      products.forEach((product, index) => {
        message += `   ${index + 1}. ${product.title}\n`;
        message += `      価格: ¥${product.price}\n`;
        message += `      売上時刻: ${product.soldAt?.toLocaleString('ja-JP')}\n\n`;
      });
    } else {
      // 6件以上の場合はサマリーのみ
      message += `📦 売れた商品 (最新5件):\n`;
      products.slice(0, 5).forEach((product, index) => {
        message += `   ${index + 1}. ${product.title} (¥${product.price})\n`;
      });
      if (productCount > 5) {
        message += `   ... 他${productCount - 5}件\n\n`;
      }
    }

    message += `🔍 詳細は管理画面でご確認ください:\n`;
    message += `   ${process.env.NEXT_PUBLIC_URL}/dashboard\n\n`;
    message += `---\n`;
    message += `eBay Checker システム`;

    return message;
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
    // 通知レコードを作成
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        subject,
        message,
        status: NotificationStatus.PENDING
      }
    });

    try {
      if (type === NotificationType.EMAIL) {
        await this.sendEmailNotification(userId, subject, message);
      } else if (type === NotificationType.LINE) {
        await this.sendLineNotification(userId, message);
      }

      // 送信成功
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date()
        }
      });
    } catch (error) {
      // 送信失敗
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * メール通知を送信
   */
  private async sendEmailNotification(userId: string, subject: string, message: string): Promise<void> {
    // ユーザーのメールアドレスを取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Resend APIを使用してメール送信
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'eBay Checker <noreply@ebay-checker.com>',
        to: [user.email],
        subject,
        text: message
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to send email: ${response.status} ${errorData}`);
    }
  }

  /**
   * LINE通知を送信
   */
  private async sendLineNotification(userId: string, message: string): Promise<void> {
    // ユーザーのLINE Notifyトークンを取得
    const notificationSettings = await prisma.notificationSettings.findUnique({
      where: { userId }
    });

    if (!notificationSettings?.lineNotifyToken) {
      throw new Error('LINE Notify token not configured');
    }

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notificationSettings.lineNotifyToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        message
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to send LINE notification: ${response.status} ${errorData}`);
    }
  }

  /**
   * 通知統計の取得
   */
  async getNotificationStats(): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
  }> {
    const stats = await prisma.notification.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    const result = {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0
    };

    stats.forEach(stat => {
      const count = stat._count.id;
      result.total += count;

      switch (stat.status) {
        case NotificationStatus.PENDING:
          result.pending = count;
          break;
        case NotificationStatus.SENT:
          result.sent = count;
          break;
        case NotificationStatus.FAILED:
          result.failed = count;
          break;
      }
    });

    return result;
  }

  /**
   * 失敗した通知の再送
   */
  async retryFailedNotifications(limit: number = 10): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const failedNotifications = await prisma.notification.findMany({
      where: {
        status: NotificationStatus.FAILED
      },
      take: limit,
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        user: true
      }
    });

    let successful = 0;
    let failed = 0;

    for (const notification of failedNotifications) {
      try {
        if (notification.type === NotificationType.EMAIL) {
          await this.sendEmailNotification(
            notification.userId,
            notification.subject,
            notification.message
          );
        } else if (notification.type === NotificationType.LINE) {
          await this.sendLineNotification(
            notification.userId,
            notification.message
          );
        }

        // 成功
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            errorMessage: null
          }
        });

        successful++;
      } catch (error) {
        // 失敗
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        failed++;
      }
    }

    return {
      processed: failedNotifications.length,
      successful,
      failed
    };
  }
}

import { PrismaClient, ProxyType, ProxyUsageEventType } from "@prisma/client";

// スクリプト実行時にも動作するように、PrismaClientを直接使用
// Next.jsアプリケーション内ではシングルトンインスタンスを使用
let prismaInstance: PrismaClient;

// グローバルスコープでprismaインスタンスを管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 既存のprismaインスタンスがあれば使用、なければ新規作成
if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  prismaInstance = new PrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }
}

const prisma = prismaInstance;

export interface ProxyConfig {
  id: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  type: ProxyType;
}

export class ProxyService {
  /**
   * 利用可能なプロキシをランダムに取得
   * ブロックされていない、アクティブなプロキシからランダムに選択
   */
  async getAvailableProxy(): Promise<ProxyConfig | null> {
    const now = new Date();
    
    // 利用可能なプロキシを取得
    // - isActiveがtrue
    // - blockedUntilがnull、または現在時刻より前（ブロック期限が切れている）
    const availableProxies = await prisma.proxy.findMany({
      where: {
        isActive: true,
        OR: [
          { blockedUntil: null },
          { blockedUntil: { lt: now } }
        ]
      }
    });

    if (availableProxies.length === 0) {
      console.warn('⚠️  利用可能なプロキシがありません');
      return null;
    }

    // ランダムに選択
    const randomIndex = Math.floor(Math.random() * availableProxies.length);
    const selectedProxy = availableProxies[randomIndex];

    console.log(`🎲 プロキシをランダム選択: ${selectedProxy.host}:${selectedProxy.port} (${selectedProxy.type})`);

    return {
      id: selectedProxy.id,
      host: selectedProxy.host,
      port: selectedProxy.port,
      username: selectedProxy.username,
      password: selectedProxy.password,
      type: selectedProxy.type
    };
  }

  /**
   * プロキシを1時間ブロック
   */
  async markProxyAsBlocked(proxyId: string): Promise<void> {
    const oneHourLater = new Date(Date.now() + 60 * 60 * 1000); // 1時間後
    
    await prisma.proxy.update({
      where: { id: proxyId },
      data: { blockedUntil: oneHourLater }
    });

    console.log(`🚫 プロキシ ${proxyId} を1時間ブロックしました (解除予定: ${oneHourLater.toISOString()})`);
  }

  /**
   * プロキシ使用ログを記録
   */
  async logProxyUsage(
    proxyId: string,
    eventType: ProxyUsageEventType,
    options?: {
      storeId?: string;
      url?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await prisma.proxyUsageLog.create({
      data: {
        proxyId,
        eventType,
        storeId: options?.storeId || null,
        url: options?.url || null,
        errorMessage: options?.errorMessage || null
      }
    });

    const logMessage = `📝 プロキシ使用ログ: ${eventType} (proxyId: ${proxyId})`;
    if (options?.url) {
      console.log(`${logMessage}, URL: ${options.url}`);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * 全プロキシ一覧を取得
   */
  async getAllProxies(): Promise<Array<{
    id: string;
    host: string;
    port: number;
    username: string | null;
    password: string | null;
    type: ProxyType;
    isActive: boolean;
    blockedUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const proxies = await prisma.proxy.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return proxies.map(proxy => ({
      id: proxy.id,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      type: proxy.type,
      isActive: proxy.isActive,
      blockedUntil: proxy.blockedUntil,
      createdAt: proxy.createdAt,
      updatedAt: proxy.updatedAt
    }));
  }

  /**
   * プロキシを追加
   */
  async addProxy(data: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    type?: ProxyType;
    isActive?: boolean;
  }): Promise<string> {
    const proxy = await prisma.proxy.create({
      data: {
        host: data.host,
        port: data.port,
        username: data.username || null,
        password: data.password || null,
        type: data.type || ProxyType.HTTP,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    console.log(`✅ プロキシを追加しました: ${proxy.host}:${proxy.port} (${proxy.type})`);
    return proxy.id;
  }

  /**
   * プロキシを更新
   */
  async updateProxy(
    proxyId: string,
    data: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      type?: ProxyType;
      isActive?: boolean;
    }
  ): Promise<void> {
    await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        ...(data.host !== undefined && { host: data.host }),
        ...(data.port !== undefined && { port: data.port }),
        ...(data.username !== undefined && { username: data.username || null }),
        ...(data.password !== undefined && { password: data.password || null }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      }
    });

    console.log(`✅ プロキシ ${proxyId} を更新しました`);
  }

  /**
   * プロキシを削除
   */
  async deleteProxy(proxyId: string): Promise<void> {
    await prisma.proxy.delete({
      where: { id: proxyId }
    });

    console.log(`✅ プロキシ ${proxyId} を削除しました`);
  }

  /**
   * プロキシの使用ログを取得
   */
  async getProxyUsageLogs(
    proxyId?: string,
    limit: number = 100
  ): Promise<Array<{
    id: string;
    proxyId: string;
    eventType: ProxyUsageEventType;
    storeId: string | null;
    url: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }>> {
    const logs = await prisma.proxyUsageLog.findMany({
      where: proxyId ? { proxyId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return logs.map(log => ({
      id: log.id,
      proxyId: log.proxyId,
      eventType: log.eventType,
      storeId: log.storeId,
      url: log.url,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt
    }));
  }
}

// シングルトンインスタンス
export const proxyService = new ProxyService();



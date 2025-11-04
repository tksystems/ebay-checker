export interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  type: 'http' | 'socks5';
  enabled: boolean;
}

export interface CrawlConfig {
  pageInterval: number; // ページ間の待機時間（ミリ秒）
  initialDelay: number; // 初回通信前の待機時間（ミリ秒）
  pageLoadDelay: number; // ページ読み込み後の待機時間（ミリ秒）
  storeInterval: number; // ストア間の待機時間（ミリ秒）
}

export const getProxyConfig = (): ProxyConfig => {
  return {
    host: process.env.PROXY_HOST || '66.93.6.79',
    port: parseInt(process.env.PROXY_PORT || '50100'),
    username: process.env.PROXY_USERNAME || 'xxxxx',
    password: process.env.PROXY_PASSWORD || 'xxxxx',
    type: (process.env.PROXY_TYPE as 'http' | 'socks5') || 'http',
    enabled: process.env.USE_PROXY === 'true', // デフォルトで無効
  };
};

export const getCrawlConfig = (): CrawlConfig => {
  return {
    pageInterval: parseInt(process.env.CRAWL_PAGE_INTERVAL || '10000'), // デフォルト10秒
    initialDelay: parseInt(process.env.CRAWL_INITIAL_DELAY || '10000'), // デフォルト10秒
    pageLoadDelay: parseInt(process.env.CRAWL_PAGE_LOAD_DELAY || '10000'), // デフォルト10秒
    storeInterval: parseInt(process.env.CRAWL_STORE_INTERVAL || '10000'), // デフォルト10秒
  };
};

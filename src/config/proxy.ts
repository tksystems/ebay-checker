export interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  type: 'http' | 'socks5';
  enabled: boolean;
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

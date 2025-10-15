import { EbayApiResponse } from '@/types/ebay-api';

/**
 * eBay API HTTPクライアント
 * ユニットテスト可能な設計
 */
export class EbayApiClient {
  private readonly baseUrl = 'https://apisd.ebay.com';
  private readonly authorization: string;

  constructor(authorization?: string) {
    this.authorization = authorization || process.env.EBAY_API_AUTHORIZATION || '';
    
    if (!this.authorization) {
      throw new Error('EBAY_API_AUTHORIZATION is required');
    }
  }

  /**
   * 商品詳細情報を取得
   */
  async getProductDetails(itemId: string): Promise<EbayApiResponse> {
    const url = `${this.baseUrl}/experience/listing_details/v2/view_item?itemId=${itemId}`;
    
    const headers = {
      'Host': 'apisd.ebay.com',
      'User-Agent': 'eBayiPhone/6.227.1',
      'X-EBAY-C-TERRITORY-ID': 'JP',
      'Connection': 'keep-alive',
      'Authorization': `Bearer ${this.authorization}`,
      'Accept-Language': 'ja-JP',
      'X-EBAY-C-CULTURAL-PREF': 'Currency=JPY,Timezone=Asia/Tokyo,Units=Metric',
      'Accept': 'application/json;presentity=split',
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY-US',
      'ebay-ets-api-intent': 'foreground',
      'Accept-Encoding': 'gzip, deflate, br'
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        // タイムアウト設定
        signal: AbortSignal.timeout(30000) // 30秒
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data as EbayApiResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch product details for item ${itemId}: ${error.message}`);
      }
      throw new Error(`Unknown error occurred while fetching product details for item ${itemId}`);
    }
  }

  /**
   * 複数の商品詳細を並列取得
   */
  async getMultipleProductDetails(itemIds: string[]): Promise<Array<{ itemId: string; data?: EbayApiResponse; error?: string }>> {
    const promises = itemIds.map(async (itemId) => {
      try {
        const data = await this.getProductDetails(itemId);
        return { itemId, data };
      } catch (error) {
        return { 
          itemId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    return Promise.all(promises);
  }
}

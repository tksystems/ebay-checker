/**
 * eBay API レスポンス型定義
 */

export interface EbayApiResponse {
  modules: {
    VLS: {
      listing: {
        itemVariations: Array<{
          quantityAndAvailabilityByLogisticsPlans: Array<{
            quantityAndAvailability: {
              availabilityStatus: string;
              availableQuantity: number;
              soldQuantity: number;
              remainingQuantity: number;
            };
          }>;
        }>;
      };
    };
  };
}

export interface EbayProductDetails {
  itemId: string;
  availabilityStatus: string;
  availableQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  hasStock: boolean;
}

export interface EbayApiError {
  error: string;
  message: string;
  statusCode?: number;
}

export interface EbayVerificationResult {
  success: boolean;
  productDetails?: EbayProductDetails;
  error?: EbayApiError;
  isSold: boolean;
  isOutOfStock: boolean;
  isListingEnded: boolean;
}

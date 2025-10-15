import { EbayApiClient } from '../src/services/ebayApiClient';
import { EbayResponseParser } from '../src/services/ebayResponseParser';

async function main() {
  console.log('🔍 eBay APIで商品の実際の状態を確認します...');

  try {
    const apiClient = new EbayApiClient();
    const responseParser = new EbayResponseParser();

    // テスト用の商品ID（売上確認済みとしてマークされている商品）
    const testItemIds = [
      '335887968122', // Transformers Laserdisc
      '335459531798', // Fernandez ZO-3 Rilakkuma ギター
      '336096571599', // ミツトヨ BM1-9LT-0
    ];

    for (const itemId of testItemIds) {
      console.log(`\n🔍 商品ID: ${itemId} を確認中...`);
      
      try {
        const apiResponse = await apiClient.getProductDetails(itemId);
        const productDetails = responseParser.parseProductDetails(itemId, apiResponse);
        const statusAnalysis = responseParser.analyzeProductStatus(productDetails);

        console.log(`   📊 API結果:`);
        console.log(`      在庫状況: ${productDetails.availabilityStatus}`);
        console.log(`      利用可能数量: ${productDetails.availableQuantity}`);
        console.log(`      売上数量: ${productDetails.soldQuantity}`);
        console.log(`      残り数量: ${productDetails.remainingQuantity}`);
        console.log(`      利用可能: ${productDetails.isAvailable}`);
        console.log(`      売り切れ: ${productDetails.isSoldOut}`);
        console.log(`      在庫あり: ${productDetails.hasStock}`);
        
        console.log(`   🎯 判定結果:`);
        console.log(`      売れた: ${statusAnalysis.isSold}`);
        console.log(`      在庫切れ: ${statusAnalysis.isOutOfStock}`);
        console.log(`      出品終了: ${statusAnalysis.isListingEnded}`);
        console.log(`      理由: ${statusAnalysis.reason}`);

        // 少し待機（API制限対策）
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
  }
}

main().catch(console.error);




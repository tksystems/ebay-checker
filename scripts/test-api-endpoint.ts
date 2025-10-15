async function main() {
  console.log('🔍 APIエンドポイントをテストします...');

  try {
    const storeId = 'cmgg0uiv40000wy0nxb3t4pq0';
    const url = `http://localhost:3000/api/stores/${storeId}/products?limit=100`;
    
    console.log(`📡 API URL: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ API成功: ${data.products.length}件の商品を取得`);
      
      // ステータス別の統計
      const statusStats = data.products.reduce((acc: any, product: any) => {
        acc[product.status] = (acc[product.status] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\n📊 APIから取得した商品のステータス分布:');
      Object.entries(statusStats).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}件`);
      });
      
      // 売れた商品を表示
      const soldProducts = data.products.filter((p: any) => p.status === 'SOLD');
      console.log(`\n💰 売れた商品: ${soldProducts.length}件`);
      
      if (soldProducts.length > 0) {
        console.log('\n📋 売れた商品の詳細:');
        soldProducts.slice(0, 5).forEach((product: any, index: number) => {
          console.log(`${index + 1}. ${product.title.substring(0, 50)}...`);
          console.log(`   ステータス: ${product.status}`);
          console.log(`   売上日時: ${product.soldAt ? new Date(product.soldAt).toLocaleString('ja-JP') : 'N/A'}`);
          console.log(`   最終確認: ${new Date(product.lastSeenAt).toLocaleString('ja-JP')}`);
        });
        
        if (soldProducts.length > 5) {
          console.log(`   ... 他 ${soldProducts.length - 5}件`);
        }
      }
      
    } else {
      console.error('❌ API失敗:', data.error);
    }
    
  } catch (error) {
    console.error('❌ APIテスト中にエラーが発生しました:', error);
  }
}

main().catch(console.error);




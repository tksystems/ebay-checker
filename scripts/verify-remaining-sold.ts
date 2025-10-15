import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';
import { EbayDetailVerificationService } from '../src/services/ebayDetailVerificationService';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 残りの「売れた」商品を実際に検証します...');

  try {
    // 残りの売上確認済み商品を取得
    const soldProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
      },
      take: 5, // 最初の5件をテスト
    });

    console.log(`📦 検証対象: ${soldProducts.length}件の商品`);

    if (soldProducts.length === 0) {
      console.log('✅ 検証対象の商品はありません。');
      return;
    }

    const verificationService = new EbayDetailVerificationService();
    let verifiedCount = 0;
    let stillSoldCount = 0;
    let nowActiveCount = 0;
    let errorCount = 0;

    for (const product of soldProducts) {
      console.log(`\n🔍 検証中: ${product.title.substring(0, 50)}...`);
      console.log(`   eBay Item ID: ${product.ebayItemId}`);
      console.log(`   現在のステータス: ${product.status} + ${product.verificationStatus}`);

      try {
        const result = await verificationService.verifyAndUpdateProduct(product.id);
        
        if (result.success && result.updatedProduct) {
          console.log(`   ✅ 検証完了: ${result.updatedProduct.status} + ${result.updatedProduct.verificationStatus}`);
          
          if (result.updatedProduct.verificationStatus === VerificationStatus.SOLD_CONFIRMED) {
            stillSoldCount++;
            console.log(`   💰 本当に売れていました！`);
          } else if (result.updatedProduct.status === ProductStatus.ACTIVE) {
            nowActiveCount++;
            console.log(`   🔄 実際は販売中でした（修正済み）`);
          }
          
          verifiedCount++;
        } else {
          console.log(`   ❌ 検証失敗: ${result.error}`);
          errorCount++;
        }
        
        // API制限対策（2秒待機）
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ 検証エラー:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 検証結果:');
    console.log(`   検証完了: ${verifiedCount}件`);
    console.log(`   本当に売上確認済み: ${stillSoldCount}件`);
    console.log(`   実際は販売中（修正済み）: ${nowActiveCount}件`);
    console.log(`   エラー: ${errorCount}件`);

    if (nowActiveCount > 0) {
      console.log('\n✅ データの整合性が修正されました！');
    }

  } catch (error) {
    console.error('❌ 検証中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




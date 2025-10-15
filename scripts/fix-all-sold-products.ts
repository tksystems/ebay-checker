import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';
import { EbayDetailVerificationService } from '../src/services/ebayDetailVerificationService';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 すべての過去の売上確認済み商品を再検証します...');

  try {
    // 売上確認済みの商品をすべて取得
    const soldProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
      },
    });

    console.log(`📦 再検証対象: ${soldProducts.length}件の商品`);

    if (soldProducts.length === 0) {
      console.log('✅ 再検証対象の商品はありません。');
      return;
    }

    const verificationService = new EbayDetailVerificationService();
    let verifiedCount = 0;
    let stillSoldCount = 0;
    let nowActiveCount = 0;
    let errorCount = 0;

    // バッチ処理（10件ずつ）
    const batchSize = 10;
    for (let i = 0; i < soldProducts.length; i += batchSize) {
      const batch = soldProducts.slice(i, i + batchSize);
      console.log(`\n📦 バッチ ${Math.floor(i / batchSize) + 1}/${Math.ceil(soldProducts.length / batchSize)}: ${batch.length}件を処理中...`);

      for (const product of batch) {
        console.log(`🔍 再検証中: ${product.title.substring(0, 50)}...`);
        console.log(`   eBay Item ID: ${product.ebayItemId}`);

        try {
          const result = await verificationService.verifyAndUpdateProduct(product.id);
          
          if (result.success && result.updatedProduct) {
            console.log(`   ✅ 検証完了: ${result.updatedProduct.status} + ${result.updatedProduct.verificationStatus}`);
            
            if (result.updatedProduct.verificationStatus === VerificationStatus.SOLD_CONFIRMED) {
              stillSoldCount++;
            } else if (result.updatedProduct.status === ProductStatus.ACTIVE) {
              nowActiveCount++;
            }
            
            verifiedCount++;
          } else {
            console.log(`   ❌ 検証失敗: ${result.error}`);
            errorCount++;
          }
          
          // API制限対策（1秒待機）
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`   ❌ 検証エラー:`, error);
          errorCount++;
        }
      }

      // バッチ間の待機（5秒）
      if (i + batchSize < soldProducts.length) {
        console.log(`⏳ 5秒待機中...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log('\n📊 再検証結果:');
    console.log(`   検証完了: ${verifiedCount}件`);
    console.log(`   まだ売上確認済み: ${stillSoldCount}件`);
    console.log(`   現在販売中: ${nowActiveCount}件`);
    console.log(`   エラー: ${errorCount}件`);

    if (nowActiveCount > 0) {
      console.log('\n✅ データ整合性の修正が完了しました！');
      console.log(`   ${nowActiveCount}件の商品が正しく「販売中」に修正されました。`);
    }

  } catch (error) {
    console.error('❌ 再検証中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




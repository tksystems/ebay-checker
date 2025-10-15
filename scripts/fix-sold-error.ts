import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 SOLD+ERRORステータスの商品を修正します...');

  try {
    // SOLD+ERRORの商品を取得
    const soldErrorProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.ERROR,
      },
      select: {
        id: true,
        title: true,
        ebayItemId: true,
        verificationError: true,
      }
    });

    console.log(`📦 修正対象: ${soldErrorProducts.length}件のSOLD+ERROR商品`);

    if (soldErrorProducts.length === 0) {
      console.log('✅ 修正対象の商品はありません。');
      return;
    }

    console.log('\n📋 修正対象商品:');
    soldErrorProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title.substring(0, 50)}...`);
      console.log(`   eBay Item ID: ${product.ebayItemId}`);
      console.log(`   エラー: ${product.verificationError || 'N/A'}`);
    });

    // 一括更新を実行
    console.log('\n🔧 一括更新を実行中...');
    const updateResult = await prisma.product.updateMany({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.ERROR,
      },
      data: {
        status: ProductStatus.ACTIVE,
        verificationStatus: VerificationStatus.VERIFIED,
        lastVerifiedAt: new Date(),
        verificationError: 'Fixed: Reset from SOLD+ERROR status',
        soldAt: null, // 売上日時をクリア
      }
    });

    console.log(`✅ 更新完了: ${updateResult.count}件の商品を修正しました`);

    // 修正後の統計を確認
    const updatedStats = await prisma.product.groupBy({
      by: ['status', 'verificationStatus'],
      _count: {
        id: true,
      },
    });

    console.log('\n📊 修正後の統計:');
    updatedStats.forEach(s => {
      console.log(`   ${s.status}+${s.verificationStatus}: ${s._count.id}件`);
    });

    console.log('\n🎉 SOLD+ERROR商品の修正が完了しました！');

  } catch (error) {
    console.error('❌ 修正中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




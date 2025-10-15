import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 大量のREMOVED+PENDING商品を一括処理します...');

  try {
    const storeId = 'cmgg0uiv40000wy0nxb3t4pq0';

    // REMOVED+PENDING商品を取得
    const removedProducts = await prisma.product.findMany({
      where: {
        storeId,
        status: ProductStatus.REMOVED,
        verificationStatus: VerificationStatus.PENDING,
      },
      select: {
        id: true,
        title: true,
        firstSeenAt: true,
        lastSeenAt: true,
      }
    });

    console.log(`📦 処理対象: ${removedProducts.length}件のREMOVED+PENDING商品`);

    if (removedProducts.length === 0) {
      console.log('✅ 処理対象の商品はありません。');
      return;
    }

    // 古い商品（24時間以上前）を一括でLISTING_ENDEDに変更
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const oldRemovedProducts = await prisma.product.findMany({
      where: {
        storeId,
        status: ProductStatus.REMOVED,
        verificationStatus: VerificationStatus.PENDING,
        firstSeenAt: {
          lt: twentyFourHoursAgo
        }
      }
    });

    console.log(`📅 24時間以上前の古い商品: ${oldRemovedProducts.length}件`);

    if (oldRemovedProducts.length > 0) {
      console.log('\n🔧 古い商品を一括でLISTING_ENDEDに変更中...');
      
      const updateResult = await prisma.product.updateMany({
        where: {
          storeId,
          status: ProductStatus.REMOVED,
          verificationStatus: VerificationStatus.PENDING,
          firstSeenAt: {
            lt: twentyFourHoursAgo
          }
        },
        data: {
          status: ProductStatus.ENDED,
          verificationStatus: VerificationStatus.LISTING_ENDED,
          lastVerifiedAt: new Date(),
          verificationError: 'Bulk processed: Old removed items marked as listing ended',
        }
      });

      console.log(`✅ ${updateResult.count}件の古い商品をLISTING_ENDEDに変更しました`);
    }

    // 残りの商品数を確認
    const remainingRemovedProducts = await prisma.product.count({
      where: {
        storeId,
        status: ProductStatus.REMOVED,
        verificationStatus: VerificationStatus.PENDING,
      }
    });

    console.log(`📊 残りのREMOVED+PENDING商品: ${remainingRemovedProducts}件`);

    // 最終統計
    const finalStats = await prisma.product.groupBy({
      by: ['status', 'verificationStatus'],
      _count: {
        id: true,
      },
      where: {
        storeId
      }
    });

    console.log('\n📊 最終統計:');
    finalStats.forEach(s => {
      console.log(`   ${s.status}+${s.verificationStatus}: ${s._count.id}件`);
    });

    console.log('\n🎉 一括処理が完了しました！');
    console.log('💡 残りの商品は個別に検証されます。');

  } catch (error) {
    console.error('❌ 処理中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




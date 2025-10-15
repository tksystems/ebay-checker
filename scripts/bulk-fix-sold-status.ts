import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 データベースを直接修正して、誤った「売上確認済み」商品を一括で「販売中」に変更します...');

  try {
    // 現在の状況を確認
    const currentStats = await prisma.product.groupBy({
      by: ['status', 'verificationStatus'],
      _count: {
        id: true,
      },
    });

    console.log('\n📊 修正前の統計:');
    currentStats.forEach(s => {
      console.log(`   ${s.status}+${s.verificationStatus}: ${s._count.id}件`);
    });

    // 売上確認済みの商品をすべて取得
    const soldProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
      },
      select: {
        id: true,
        title: true,
        ebayItemId: true,
        lastVerifiedAt: true,
      }
    });

    console.log(`\n📦 修正対象: ${soldProducts.length}件の「売上確認済み」商品`);

    if (soldProducts.length === 0) {
      console.log('✅ 修正対象の商品はありません。');
      return;
    }

    // 確認のため、最初の5件を表示
    console.log('\n📋 修正対象商品（最初の5件）:');
    soldProducts.slice(0, 5).forEach((product, index) => {
      console.log(`${index + 1}. ${product.title.substring(0, 50)}...`);
      console.log(`   eBay Item ID: ${product.ebayItemId}`);
      console.log(`   最終検証日時: ${product.lastVerifiedAt?.toLocaleString('ja-JP') || 'N/A'}`);
    });

    if (soldProducts.length > 5) {
      console.log(`   ... 他 ${soldProducts.length - 5}件`);
    }

    // 一括更新を実行
    console.log('\n🔧 一括更新を実行中...');
    const updateResult = await prisma.product.updateMany({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
      },
      data: {
        status: ProductStatus.ACTIVE,
        verificationStatus: VerificationStatus.VERIFIED,
        lastVerifiedAt: new Date(),
        verificationError: 'Bulk fix: Reset from incorrect SOLD status',
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

    console.log('\n🎉 データベース修正が完了しました！');
    console.log('💡 Webページを再読み込みすると、修正された状態が反映されます。');

  } catch (error) {
    console.error('❌ 修正中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




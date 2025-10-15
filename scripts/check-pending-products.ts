import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 未検証商品の詳細を確認します...');

  try {
    const storeId = 'cmgg0uiv40000wy0nxb3t4pq0';

    // 未検証商品を取得
    const pendingProducts = await prisma.product.findMany({
      where: {
        storeId,
        verificationStatus: VerificationStatus.PENDING,
      },
      select: {
        id: true,
        title: true,
        status: true,
        verificationStatus: true,
        firstSeenAt: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: {
        firstSeenAt: 'desc'
      },
      take: 10
    });

    console.log(`📦 未検証商品: ${pendingProducts.length}件（最初の10件を表示）`);

    if (pendingProducts.length > 0) {
      console.log('\n📋 未検証商品の詳細:');
      pendingProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title.substring(0, 50)}...`);
        console.log(`   ステータス: ${product.status}`);
        console.log(`   検証ステータス: ${product.verificationStatus}`);
        console.log(`   初回確認: ${product.firstSeenAt?.toLocaleString('ja-JP') || 'N/A'}`);
        console.log(`   最終確認: ${product.lastSeenAt?.toLocaleString('ja-JP') || 'N/A'}`);
        console.log(`   作成日時: ${product.createdAt?.toLocaleString('ja-JP') || 'N/A'}`);
        console.log('');
      });
    }

    // ステータス別の統計
    const statusStats = await prisma.product.groupBy({
      by: ['status', 'verificationStatus'],
      _count: {
        id: true,
      },
      where: {
        storeId,
        verificationStatus: VerificationStatus.PENDING
      }
    });

    console.log('\n📊 未検証商品のステータス分布:');
    statusStats.forEach(s => {
      console.log(`   ${s.status}+${s.verificationStatus}: ${s._count.id}件`);
    });

    // 最近追加された商品の統計
    const recentProducts = await prisma.product.count({
      where: {
        storeId,
        verificationStatus: VerificationStatus.PENDING,
        firstSeenAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 過去24時間以内
        }
      }
    });

    console.log(`\n📅 過去24時間以内に追加された未検証商品: ${recentProducts}件`);

  } catch (error) {
    console.error('❌ 確認中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




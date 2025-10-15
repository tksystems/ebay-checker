import { PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 売れた商品の位置を確認します...');

  try {
    const storeId = 'cmgg0uiv40000wy0nxb3t4pq0';

    // 売れた商品を取得
    const soldProducts = await prisma.product.findMany({
      where: {
        storeId,
        status: ProductStatus.SOLD,
      },
      select: {
        id: true,
        title: true,
        soldAt: true,
        lastSeenAt: true,
      },
      orderBy: [
        { soldAt: 'desc' },
        { lastSeenAt: 'desc' }
      ]
    });

    console.log(`📦 売れた商品: ${soldProducts.length}件`);

    if (soldProducts.length > 0) {
      soldProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title.substring(0, 50)}...`);
        console.log(`   売上日時: ${product.soldAt?.toLocaleString('ja-JP') || 'N/A'}`);
        console.log(`   最終確認: ${product.lastSeenAt?.toLocaleString('ja-JP') || 'N/A'}`);
        console.log('');
      });
    }

    // 全商品をソート順で取得して、売れた商品の位置を確認
    const allProducts = await prisma.product.findMany({
      where: { storeId },
      select: {
        id: true,
        title: true,
        status: true,
        soldAt: true,
        lastSeenAt: true,
      },
      orderBy: [
        { soldAt: 'desc' },
        { lastSeenAt: 'desc' }
      ]
    });

    console.log(`📊 全商品数: ${allProducts.length}件`);

    // 売れた商品の位置を検索
    const soldProductPositions: Array<{
      position: number;
      title: string;
      soldAt: string;
      lastSeenAt: string;
    }> = [];
    allProducts.forEach((product, index) => {
      if (product.status === ProductStatus.SOLD) {
        soldProductPositions.push({
          position: index + 1,
          title: product.title.substring(0, 30) + '...',
          soldAt: product.soldAt?.toLocaleString('ja-JP') || 'N/A',
          lastSeenAt: product.lastSeenAt?.toLocaleString('ja-JP') || 'N/A'
        });
      }
    });

    console.log('\n📍 売れた商品の位置:');
    soldProductPositions.forEach(item => {
      console.log(`   位置 ${item.position}: ${item.title}`);
      console.log(`     売上日時: ${item.soldAt}`);
      console.log(`     最終確認: ${item.lastSeenAt}`);
    });

    // ページネーションの影響を確認
    console.log('\n📄 ページネーション分析:');
    console.log(`   1ページ目 (1-50件): ${soldProductPositions.filter(p => p.position <= 50).length}件の売れた商品`);
    console.log(`   2ページ目 (51-100件): ${soldProductPositions.filter(p => p.position > 50 && p.position <= 100).length}件の売れた商品`);
    console.log(`   3ページ目以降: ${soldProductPositions.filter(p => p.position > 100).length}件の売れた商品`);

  } catch (error) {
    console.error('❌ 確認中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);



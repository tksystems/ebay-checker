import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Webページ表示の問題をデバッグします...');

  try {
    const storeId = 'cmgg0uiv40000wy0nxb3t4pq0'; // fsoushopのID

    // 1. 売上確認済み商品を取得
    const soldProducts = await prisma.product.findMany({
      where: {
        storeId,
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
      },
      select: {
        id: true,
        title: true,
        ebayItemId: true,
        status: true,
        verificationStatus: true,
        soldAt: true,
        lastVerifiedAt: true,
      },
      orderBy: {
        soldAt: 'desc'
      }
    });

    console.log(`\n📦 売上確認済み商品: ${soldProducts.length}件`);

    if (soldProducts.length > 0) {
      console.log('\n📋 売上確認済み商品の詳細:');
      soldProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   eBay Item ID: ${product.ebayItemId}`);
        console.log(`   ステータス: ${product.status}`);
        console.log(`   検証ステータス: ${product.verificationStatus}`);
        console.log(`   売上日時: ${product.soldAt?.toLocaleString('ja-JP') || 'N/A'}`);
        console.log(`   最終検証日時: ${product.lastVerifiedAt?.toLocaleString('ja-JP') || 'N/A'}`);
        console.log('');
      });
    }

    // 2. 全商品のステータス分布
    const allStats = await prisma.product.groupBy({
      by: ['status', 'verificationStatus'],
      _count: {
        id: true,
      },
      where: {
        storeId
      }
    });

    console.log('\n📊 ストア内の全商品統計:');
    allStats.forEach(s => {
      console.log(`   ${s.status}+${s.verificationStatus}: ${s._count.id}件`);
    });

    // 3. 最近のクロールログを確認
    const recentCrawlLogs = await prisma.crawlLog.findMany({
      where: { storeId },
      orderBy: { startedAt: 'desc' },
      take: 3,
    });

    console.log('\n📋 最近のクロールログ:');
    recentCrawlLogs.forEach((log, index) => {
      console.log(`${index + 1}. ログID: ${log.id}`);
      console.log(`   ステータス: ${log.status}`);
      console.log(`   商品数: ${log.productsFound}件`);
      console.log(`   新商品: ${log.productsNew}件`);
      console.log(`   更新: ${log.productsUpdated}件`);
      console.log(`   売れた: ${log.productsSold}件`);
      console.log(`   開始時刻: ${log.startedAt.toLocaleString('ja-JP')}`);
      console.log(`   完了時刻: ${log.completedAt?.toLocaleString('ja-JP') || 'null'}`);
      console.log('');
    });

    // 4. Webページで表示される可能性のある商品を確認
    console.log('\n🔍 Webページ表示用クエリのテスト:');
    
    // 一般的なWebページのクエリをシミュレート
    const webDisplayProducts = await prisma.product.findMany({
      where: {
        storeId,
        status: {
          in: [ProductStatus.SOLD, ProductStatus.ACTIVE, ProductStatus.ENDED]
        }
      },
      select: {
        id: true,
        title: true,
        status: true,
        verificationStatus: true,
        soldAt: true,
      },
      orderBy: {
        soldAt: 'desc'
      },
      take: 10
    });

    console.log(`📦 Webページ表示対象商品（最初の10件）: ${webDisplayProducts.length}件`);
    webDisplayProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title.substring(0, 50)}...`);
      console.log(`   ステータス: ${product.status}`);
      console.log(`   検証ステータス: ${product.verificationStatus}`);
      console.log(`   売上日時: ${product.soldAt?.toLocaleString('ja-JP') || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




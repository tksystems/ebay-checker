import { PrismaClient, ProductStatus, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 売上確認済み商品の詳細を確認します...');

  try {
    // 売上確認済みの商品を取得
    const soldProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
      },
      take: 5, // 最初の5件を確認
      orderBy: {
        lastVerifiedAt: 'desc'
      }
    });

    console.log(`📦 確認対象: ${soldProducts.length}件の商品`);

    if (soldProducts.length === 0) {
      console.log('✅ 売上確認済み商品はありません。');
      return;
    }

    console.log('\n📋 売上確認済み商品の詳細:');
    soldProducts.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.title}`);
      console.log(`   eBay Item ID: ${product.ebayItemId}`);
      console.log(`   ステータス: ${product.status}`);
      console.log(`   検証ステータス: ${product.verificationStatus}`);
      console.log(`   最終検証日時: ${product.lastVerifiedAt?.toLocaleString('ja-JP') || 'N/A'}`);
      console.log(`   売上日時: ${product.soldAt?.toLocaleString('ja-JP') || 'N/A'}`);
      console.log(`   最終確認日時: ${product.lastSeenAt?.toLocaleString('ja-JP') || 'N/A'}`);
      console.log(`   eBay URL: https://www.ebay.com/itm/${product.ebayItemId}`);
      console.log(`   検証エラー: ${product.verificationError || 'N/A'}`);
    });

    // 統計情報
    const totalSold = await prisma.product.count({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
      }
    });

    const recentSold = await prisma.product.count({
      where: {
        status: ProductStatus.SOLD,
        verificationStatus: VerificationStatus.SOLD_CONFIRMED,
        lastVerifiedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 過去24時間以内
        }
      }
    });

    console.log('\n📊 統計情報:');
    console.log(`   総売上確認済み商品数: ${totalSold}件`);
    console.log(`   過去24時間以内の検証: ${recentSold}件`);

  } catch (error) {
    console.error('❌ 確認中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




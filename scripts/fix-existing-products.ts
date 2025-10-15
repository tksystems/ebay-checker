#!/usr/bin/env tsx

/**
 * 既存商品の検証ステータス修正スクリプト
 * マイグレーション前から存在する商品を適切な状態に更新
 */

import { prisma } from '../src/lib/prisma';
import { VerificationStatus, ProductStatus } from '@prisma/client';

async function fixExistingProducts() {
  console.log('🔧 既存商品の検証ステータスを修正します...');

  try {
    // 現在ACTIVEな商品（ストアに存在する商品）を検証済みに更新
    const activeProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE
      }
    });

    console.log(`📦 ACTIVE商品: ${activeProducts.length}件`);

    if (activeProducts.length > 0) {
      await prisma.product.updateMany({
        where: {
          status: ProductStatus.ACTIVE
        },
        data: {
          verificationStatus: VerificationStatus.VERIFIED,
          lastVerifiedAt: new Date()
        }
      });

      console.log(`✅ ${activeProducts.length}件のACTIVE商品を検証済みに更新しました`);
    }

    // 現在SOLDな商品（既に売上として記録されている商品）を売上確認済みに更新
    const soldProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.SOLD
      }
    });

    console.log(`💰 SOLD商品: ${soldProducts.length}件`);

    if (soldProducts.length > 0) {
      await prisma.product.updateMany({
        where: {
          status: ProductStatus.SOLD
        },
        data: {
          verificationStatus: VerificationStatus.SOLD_CONFIRMED,
          lastVerifiedAt: new Date()
        }
      });

      console.log(`✅ ${soldProducts.length}件のSOLD商品を売上確認済みに更新しました`);
    }

    // 現在ENDEDな商品を出品終了として更新
    const endedProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.ENDED
      }
    });

    console.log(`🏁 ENDED商品: ${endedProducts.length}件`);

    if (endedProducts.length > 0) {
      await prisma.product.updateMany({
        where: {
          status: ProductStatus.ENDED
        },
        data: {
          verificationStatus: VerificationStatus.LISTING_ENDED,
          lastVerifiedAt: new Date()
        }
      });

      console.log(`✅ ${endedProducts.length}件のENDED商品を出品終了として更新しました`);
    }

    // 現在REMOVEDな商品（今回のマイグレーションで追加されたステータス）は未検証のまま
    const removedProducts = await prisma.product.findMany({
      where: {
        status: ProductStatus.REMOVED
      }
    });

    console.log(`❓ REMOVED商品: ${removedProducts.length}件（これらが真の未検証商品）`);

    // 統計表示
    const stats = await prisma.product.groupBy({
      by: ['verificationStatus'],
      _count: {
        id: true
      }
    });

    console.log('\n📊 修正後の検証統計:');
    stats.forEach(stat => {
      const count = stat._count.id;
      console.log(`   ${stat.verificationStatus}: ${count}件`);
    });

    console.log('\n🎉 既存商品の修正が完了しました！');
    console.log('💡 今後は、クローラーで商品が消えた場合のみ未検証商品として処理されます。');

  } catch (error) {
    console.error('❌ 修正中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  fixExistingProducts().catch(error => {
    console.error('❌ スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

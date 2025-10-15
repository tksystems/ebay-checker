#!/usr/bin/env tsx

/**
 * 現在の未検証商品のクリーンアップスクリプト
 * 現在のPENDING商品を適切な状態に更新
 */

import { prisma } from '../src/lib/prisma';
import { VerificationStatus, ProductStatus } from '@prisma/client';

async function cleanupCurrentPending() {
  console.log('🧹 現在の未検証商品のクリーンアップを開始します...');

  try {
    // 現在の未検証商品を取得
    const pendingProducts = await prisma.product.findMany({
      where: {
        verificationStatus: VerificationStatus.PENDING
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true
      }
    });

    console.log(`📦 現在の未検証商品: ${pendingProducts.length}件`);

    if (pendingProducts.length === 0) {
      console.log('✅ クリーンアップ対象の商品がありません。');
      return;
    }

    // 詳細表示
    console.log('\n📋 クリーンアップ対象商品:');
    pendingProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`);
      console.log(`   ステータス: ${product.status}`);
      console.log(`   更新日時: ${product.updatedAt}`);
      console.log('');
    });

    // 現在の未検証商品を出品終了として扱う
    const updateResult = await prisma.product.updateMany({
      where: {
        verificationStatus: VerificationStatus.PENDING
      },
      data: {
        verificationStatus: VerificationStatus.LISTING_ENDED,
        status: ProductStatus.ENDED,
        lastVerifiedAt: new Date()
      }
    });

    console.log(`✅ ${updateResult.count}件の未検証商品を出品終了として更新しました。`);

    // 統計表示
    const stats = await prisma.product.groupBy({
      by: ['verificationStatus'],
      _count: {
        id: true
      }
    });

    console.log('\n📊 更新後の検証統計:');
    stats.forEach(stat => {
      const count = stat._count.id;
      console.log(`   ${stat.verificationStatus}: ${count}件`);
    });

    console.log('\n🎉 クリーンアップが完了しました！');
    console.log('💡 今後は、新しいクローラー実行時にのみ未検証商品が作成されます。');

  } catch (error) {
    console.error('❌ クリーンアップ中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  cleanupCurrentPending().catch(error => {
    console.error('❌ スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

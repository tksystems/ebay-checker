#!/usr/bin/env tsx

/**
 * 未検証商品のデバッグスクリプト
 * なぜ未検証商品が存在するのかを調査
 */

import { prisma } from '../src/lib/prisma';
import { VerificationStatus, ProductStatus } from '@prisma/client';

async function debugPendingProducts() {
  console.log('🔍 未検証商品のデバッグを開始します...');

  try {
    // 未検証商品を取得
    const pendingProducts = await prisma.product.findMany({
      where: {
        verificationStatus: VerificationStatus.PENDING
      },
      select: {
        id: true,
        ebayItemId: true,
        title: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`📦 未検証商品: ${pendingProducts.length}件`);

    if (pendingProducts.length > 0) {
      console.log('\n📋 未検証商品の詳細:');
      pendingProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   eBay Item ID: ${product.ebayItemId}`);
        console.log(`   ステータス: ${product.status}`);
        console.log(`   最終確認: ${product.lastSeenAt}`);
        console.log(`   作成日時: ${product.createdAt}`);
        console.log(`   更新日時: ${product.updatedAt}`);
        console.log('');
      });
    }

    // 最近更新された商品を確認
    console.log('🕐 最近更新された商品（過去1時間）:');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentProducts = await prisma.product.findMany({
      where: {
        updatedAt: {
          gte: oneHourAgo
        }
      },
      select: {
        id: true,
        ebayItemId: true,
        title: true,
        status: true,
        verificationStatus: true,
        lastSeenAt: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 20
    });

    console.log(`📦 最近更新された商品: ${recentProducts.length}件`);
    recentProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.title}`);
      console.log(`   ステータス: ${product.status}`);
      console.log(`   検証ステータス: ${product.verificationStatus}`);
      console.log(`   更新日時: ${product.updatedAt}`);
      console.log('');
    });

    // ステータス別の統計
    console.log('📊 ステータス別統計:');
    const statusStats = await prisma.product.groupBy({
      by: ['status', 'verificationStatus'],
      _count: {
        id: true
      }
    });

    statusStats.forEach(stat => {
      console.log(`   ${stat.status} + ${stat.verificationStatus}: ${stat._count.id}件`);
    });

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  debugPendingProducts().catch(error => {
    console.error('❌ スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

#!/usr/bin/env tsx

/**
 * 比較対象商品のデバッグスクリプト
 * なぜ比較対象が0件になるのかを調査
 */

import { prisma } from '../src/lib/prisma';
import { ProductStatus, VerificationStatus } from '@prisma/client';

async function debugComparison() {
  console.log('🔍 比較対象商品のデバッグを開始します...');

  try {
    const storeId = 'cmgg0uiv40000wy0nxb3t4pq0'; // fsoushopのID

    // 30分前の時刻を計算
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    console.log(`⏰ 30分前の時刻: ${thirtyMinutesAgo.toLocaleString('ja-JP')}`);

    // 30分前以降の商品を取得（現在のクエリ）
    const recentProducts = await prisma.product.findMany({
      where: { 
        storeId,
        lastSeenAt: {
          gte: thirtyMinutesAgo
        }
        // ステータス条件を削除 - すべての商品を比較対象にする
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
        lastSeenAt: 'desc'
      }
    });

    console.log(`📦 30分前以降の商品: ${recentProducts.length}件`);

    if (recentProducts.length > 0) {
      console.log('\n📋 最近の商品（最初の10件）:');
      recentProducts.slice(0, 10).forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   ステータス: ${product.status}`);
        console.log(`   検証ステータス: ${product.verificationStatus}`);
        console.log(`   最終確認: ${product.lastSeenAt}`);
        console.log(`   更新日時: ${product.updatedAt}`);
        console.log('');
      });
    }

    // 全商品の統計
    const allProducts = await prisma.product.findMany({
      where: { storeId },
      select: {
        status: true,
        verificationStatus: true,
        lastSeenAt: true
      }
    });

    console.log('📊 全商品の統計:');
    const statusStats = allProducts.reduce((acc, product) => {
      const key = `${product.status}+${product.verificationStatus}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(statusStats).forEach(([key, count]) => {
      console.log(`   ${key}: ${count}件`);
    });

    // 最終確認時刻の分布
    console.log('\n🕐 最終確認時刻の分布:');
    const now = new Date();
    const timeRanges = [
      { name: '1分以内', start: new Date(now.getTime() - 1 * 60 * 1000) },
      { name: '5分以内', start: new Date(now.getTime() - 5 * 60 * 1000) },
      { name: '10分以内', start: new Date(now.getTime() - 10 * 60 * 1000) },
      { name: '30分以内', start: new Date(now.getTime() - 30 * 60 * 1000) },
      { name: '1時間以内', start: new Date(now.getTime() - 60 * 60 * 1000) },
      { name: '1時間以上前', start: new Date(0) }
    ];

    timeRanges.forEach((range, index) => {
      const end = index < timeRanges.length - 1 ? timeRanges[index + 1].start : new Date();
      const count = allProducts.filter(product => {
        if (!product.lastSeenAt) return false;
        return product.lastSeenAt >= range.start && product.lastSeenAt < end;
      }).length;
      console.log(`   ${range.name}: ${count}件`);
    });

    // 最新のクロールログを確認
    console.log('\n📋 最新のクロールログ:');
    const recentLogs = await prisma.crawlLog.findMany({
      where: { storeId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        productsFound: true,
        productsNew: true,
        productsUpdated: true,
        productsSold: true,
        startedAt: true,
        completedAt: true
      }
    });

    recentLogs.forEach((log, index) => {
      console.log(`${index + 1}. ログID: ${log.id}`);
      console.log(`   ステータス: ${log.status}`);
      console.log(`   商品数: ${log.productsFound}件`);
      console.log(`   新商品: ${log.productsNew}件`);
      console.log(`   更新: ${log.productsUpdated}件`);
      console.log(`   売れた: ${log.productsSold}件`);
      console.log(`   開始時刻: ${log.startedAt}`);
      console.log(`   完了時刻: ${log.completedAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error);
  }
}

// スクリプトが直接実行された場合のみmainを呼び出し
if (require.main === module) {
  debugComparison().catch(error => {
    console.error('❌ スクリプト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

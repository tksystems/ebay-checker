import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 クロール状態をリセットします...');

  try {
    // 実行中のクロール状態をすべてリセット
    const result = await prisma.crawlStatus.updateMany({
      where: {
        isRunning: true
      },
      data: {
        isRunning: false,
        serverId: null,
        startedAt: null
      }
    });

    console.log(`✅ ${result.count}件のクロール状態をリセットしました`);

    // 現在の状態を確認
    const currentStatus = await prisma.crawlStatus.findMany({
      where: {
        isRunning: true
      }
    });

    console.log(`📊 現在実行中のクロール: ${currentStatus.length}件`);

    if (currentStatus.length === 0) {
      console.log('🎉 すべてのクロール状態がリセットされました！');
      console.log('💡 監視スクリプトを再実行できます。');
    }

  } catch (error) {
    console.error('❌ リセット中にエラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);




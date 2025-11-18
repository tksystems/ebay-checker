import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-1980 mx-auto text-center">
          {/* ヘッダー */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              eBay Checker
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              eBay商品の価格変動と在庫状況を自動監視
            </p>
          </div>

          {/* メイン機能 */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                価格監視
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                商品の価格変動をリアルタイムで追跡し、お得なタイミングをお知らせ
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-3xl mb-4">🔔</div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                通知機能
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                価格下落や在庫復活を即座に通知。見逃しを防ぎます
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <div className="text-3xl mb-4">📈</div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                分析レポート
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                価格トレンドや売れ行きデータを分析して最適な購入タイミングを提案
              </p>
            </div>
          </div>

          {/* CTA ボタン */}
          <div className="space-y-4">
            <Link
              href="/login"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
            >
              ログイン
              </Link>
          </div>

          {/* フッター */}
          <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              eBay Checker - 賢いショッピングのパートナー
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

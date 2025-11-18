"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { BuildingStorefrontIcon, ChartBarIcon, BellIcon, CogIcon } from "@heroicons/react/24/outline"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState({
    totalStores: 0,
    totalProducts: 0,
    activeProducts: 0,
    soldProducts: 0
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // 統計情報を取得
  useEffect(() => {
    if (session) {
      fetchStats()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stores')
      const data = await response.json()
      
      if (data.success) {
        const totalStores = data.stores.length
        const totalProducts = data.stores.reduce((sum: number, store: { productCount: number }) => sum + store.productCount, 0)
        
        setStats({
          totalStores,
          totalProducts,
          activeProducts: Math.floor(totalProducts * 0.8), // 仮の値
          soldProducts: Math.floor(totalProducts * 0.2) // 仮の値
        })
      }
    } catch (error) {
      console.error('統計情報の取得中にエラー:', error)
      // エラー時はデフォルト値を設定
      setStats({
        totalStores: 0,
        totalProducts: 0,
        activeProducts: 0,
        soldProducts: 0
      })
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-1980 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
              <p className="mt-2 text-gray-600">eBayストア監視システムの概要</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                こんにちは、{session.user?.name}さん
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {(session.user as { role?: string })?.role === "ADMIN" ? "管理者" : "顧客"}
              </span>
              <button
                onClick={() => signOut()}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-1980 mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BuildingStorefrontIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      監視ストア数
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.totalStores}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      総商品数
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.totalProducts}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center">
                    <div className="h-2 w-2 bg-green-600 rounded-full"></div>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      販売中商品
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.activeProducts}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 bg-red-100 rounded-full flex items-center justify-center">
                    <div className="h-2 w-2 bg-red-600 rounded-full"></div>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      売れた商品
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.soldProducts}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">クイックアクション</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/stores"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <BuildingStorefrontIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">ストア管理</div>
                  <div className="text-sm text-gray-500">ストアの追加・管理</div>
                </div>
              </Link>

              <Link
                href="/notifications"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <BellIcon className="h-8 w-8 text-yellow-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">通知設定</div>
                  <div className="text-sm text-gray-500">通知の管理</div>
                </div>
              </Link>

              <Link
                href="/settings"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <CogIcon className="h-8 w-8 text-gray-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">設定</div>
                  <div className="text-sm text-gray-500">システム設定</div>
                </div>
              </Link>

              <button
                onClick={() => window.open('/api/stores', '_blank')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChartBarIcon className="h-8 w-8 text-green-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">API確認</div>
                  <div className="text-sm text-gray-500">ストアAPI</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { ArrowLeftIcon, EyeIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline'

interface Product {
  id: string
  title: string
  price: number
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'REMOVED'
  lastSeenAt: string
  soldAt: string | null
}

interface Store {
  id: string
  storeName: string
  storeUrl: string
  isActive: boolean
  lastCrawledAt: string | null
  productCount: number
}

export default function ProductsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const resolvedParams = use(params)
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'SOLD' | 'ENDED' | 'REMOVED'>('all')
  const [sortBy, setSortBy] = useState<'lastSeenAt' | 'price' | 'title'>('lastSeenAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 50

  // ストア情報を取得
  const fetchStore = useCallback(async () => {
    try {
      const response = await fetch('/api/stores')
      const data = await response.json()
      
      if (data.success) {
        const foundStore = data.stores.find((s: Store) => s.id === resolvedParams.storeId)
        if (foundStore) {
          setStore(foundStore)
        } else {
          console.error('ストアが見つかりません')
        }
      }
    } catch (error) {
      console.error('ストア情報の取得中にエラー:', error)
    }
  }, [resolvedParams.storeId])

  // 商品一覧を取得
  const fetchProducts = useCallback(async () => {
    try {
      const offset = (currentPage - 1) * itemsPerPage
      const response = await fetch(`/api/stores/${resolvedParams.storeId}/products?limit=${itemsPerPage}&offset=${offset}`)
      const data = await response.json()
      
      if (data.success) {
        setProducts(data.products)
        setTotalPages(Math.ceil(data.pagination.count / itemsPerPage))
      } else {
        console.error('商品一覧の取得に失敗:', data.error)
      }
    } catch (error) {
      console.error('商品一覧の取得中にエラー:', error)
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.storeId, currentPage, itemsPerPage])

  useEffect(() => {
    fetchStore()
  }, [resolvedParams.storeId, fetchStore])

  useEffect(() => {
    if (store) {
      fetchProducts()
    }
  }, [store, currentPage, fetchProducts])

  // フィルタリングとソート
  const filteredAndSortedProducts = products
    .filter(product => filter === 'all' || product.status === filter)
    .sort((a, b) => {
      let aValue: string | number, bValue: string | number
      
      switch (sortBy) {
        case 'price':
          aValue = a.price
          bValue = b.price
          break
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'lastSeenAt':
        default:
          aValue = new Date(a.lastSeenAt).getTime()
          bValue = new Date(b.lastSeenAt).getTime()
          break
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'SOLD':
        return 'bg-red-100 text-red-800'
      case 'ENDED':
        return 'bg-gray-100 text-gray-800'
      case 'REMOVED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return '販売中'
      case 'SOLD':
        return '売れた'
      case 'ENDED':
        return '終了'
      case 'REMOVED':
        return '削除'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">ストアが見つかりません</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button
              onClick={() => window.history.back()}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{store.storeName}</h1>
              <p className="mt-2 text-gray-600">商品一覧 ({store.productCount}件)</p>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* フィルターとソート */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-4">
              {/* フィルター */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">状態:</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'ACTIVE' | 'SOLD' | 'ENDED' | 'REMOVED')}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">すべて</option>
                  <option value="ACTIVE">販売中</option>
                  <option value="SOLD">売れた</option>
                  <option value="ENDED">終了</option>
                  <option value="REMOVED">削除</option>
                </select>
              </div>

              {/* ソート */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">並び順:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'lastSeenAt' | 'price' | 'title')}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="lastSeenAt">最終確認日時</option>
                  <option value="price">価格</option>
                  <option value="title">タイトル</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-900 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 商品一覧 */}
        <div className="bg-white shadow rounded-lg">
          {filteredAndSortedProducts.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">商品が見つかりません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      商品名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      価格
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終確認
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      売れた日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                          {product.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                          {product.price.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(product.status)}`}>
                          {getStatusText(product.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {new Date(product.lastSeenAt).toLocaleString('ja-JP')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.soldAt 
                          ? new Date(product.soldAt).toLocaleString('ja-JP')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => window.location.href = `/stores/${resolvedParams.storeId}/products/${product.id}`}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <EyeIcon className="h-3 w-3 mr-1" />
                          詳細
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {filteredAndSortedProducts.length}件中 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length)}件を表示
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                前へ
              </button>
              <span className="px-3 py-1 text-sm">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

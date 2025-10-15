'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { ArrowLeftIcon, CurrencyDollarIcon, ClockIcon, CalendarIcon, TagIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

interface Product {
  id: string
  title: string
  price: number
  currency: string
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'REMOVED'
  listingUrl: string
  imageUrl: string | null
  condition: string | null
  quantity: number
  ebayItemId: string
  lastSeenAt: string
  soldAt: string | null
  createdAt: string
  updatedAt: string
}

interface Store {
  id: string
  storeName: string
  storeUrl: string
  isActive: boolean
  lastCrawledAt: string | null
  productCount: number
}

export default function ProductDetailPage({ 
  params 
}: { 
  params: Promise<{ storeId: string; productId: string }> 
}) {
  const resolvedParams = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 商品詳細を取得
  const fetchProduct = useCallback(async () => {
    try {
      const response = await fetch(`/api/stores/${resolvedParams.storeId}/products/${resolvedParams.productId}`)
      const data = await response.json()
      
      if (data.success) {
        setProduct(data.product)
      } else {
        setError(data.error || '商品の取得に失敗しました')
      }
    } catch (error) {
      console.error('商品詳細の取得中にエラー:', error)
      setError('商品詳細の取得中にエラーが発生しました')
    }
  }, [resolvedParams.storeId, resolvedParams.productId])

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
          setError('ストアが見つかりません')
        }
      }
    } catch (error) {
      console.error('ストア情報の取得中にエラー:', error)
      setError('ストア情報の取得中にエラーが発生しました')
    }
  }, [resolvedParams.storeId])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchProduct(), fetchStore()])
      setLoading(false)
    }
    
    loadData()
  }, [fetchProduct, fetchStore])

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

  if (error || !product || !store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{error || '商品またはストアが見つかりません'}</p>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <button
              onClick={() => window.history.back()}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">商品詳細</h1>
              <p className="mt-1 text-gray-600">{store.storeName}</p>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            {/* 商品タイトル */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.title}</h2>
              <div className="flex items-center space-x-4 mb-4">
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(product.status)}`}>
                  {getStatusText(product.status)}
                </span>
                <div className="flex items-center text-lg font-bold text-gray-900">
                  <CurrencyDollarIcon className="h-5 w-5 mr-1" />
                  {product.price.toFixed(2)} {product.currency}
                </div>
              </div>
              
              {/* eBayリンクボタン */}
              <div className="flex space-x-3">
                <a
                  href={product.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 transition-colors"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                  eBayで見る
                </a>
                {product.imageUrl && (
                  <a
                    href={product.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                    画像を見る
                  </a>
                )}
              </div>
            </div>

            {/* 商品情報 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基本情報 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">基本情報</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <TagIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">eBay商品ID</p>
                      <p className="text-sm text-gray-900 font-mono">{product.ebayItemId}</p>
                    </div>
                  </div>

                  {product.condition && (
                    <div className="flex items-center">
                      <TagIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">商品状態</p>
                        <p className="text-sm text-gray-900">{product.condition}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center">
                    <TagIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">在庫数</p>
                      <p className="text-sm text-gray-900">{product.quantity}個</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">登録日時</p>
                      <p className="text-sm text-gray-900">{new Date(product.createdAt).toLocaleString('ja-JP')}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">最終更新</p>
                      <p className="text-sm text-gray-900">{new Date(product.updatedAt).toLocaleString('ja-JP')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 販売情報 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">販売情報</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <ClockIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">最終確認日時</p>
                      <p className="text-sm text-gray-900">{new Date(product.lastSeenAt).toLocaleString('ja-JP')}</p>
                    </div>
                  </div>

                  {product.soldAt && (
                    <div className="flex items-center">
                      <CalendarIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">売れた日時</p>
                        <p className="text-sm text-gray-900">{new Date(product.soldAt).toLocaleString('ja-JP')}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center">
                    <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">価格</p>
                      <p className="text-lg font-bold text-gray-900">{product.price.toFixed(2)} {product.currency}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex space-x-4">
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  戻る
                </button>
                <button
                  onClick={() => window.location.href = `/stores/${resolvedParams.storeId}/products`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  商品一覧に戻る
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

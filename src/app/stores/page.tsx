'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, PlayIcon, EyeIcon, HeartIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Store {
  id: string
  storeName: string
  storeUrl: string
  isActive: boolean
  lastCrawledAt: string | null
  productCount: number
  isSubscribed: boolean
  subscriptionId?: string
}

interface CrawlResult {
  success: boolean
  message: string
  result?: {
    productsFound: number
    productsNew: number
    productsUpdated: number
    productsSold: number
    duration: number
  }
  error?: string
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreUrl, setNewStoreUrl] = useState('')
  const [crawling, setCrawling] = useState<string | null>(null)
  const [crawlResults, setCrawlResults] = useState<Record<string, CrawlResult>>({})

  // ストア一覧を取得
  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores')
      const data = await response.json()
      
      if (data.success) {
        setStores(data.stores)
      } else {
        console.error('ストア一覧の取得に失敗:', data.error)
      }
    } catch (error) {
      console.error('ストア一覧の取得中にエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  // ストアを追加
  const addStore = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newStoreName.trim()) {
      alert('ストア名を入力してください')
      return
    }

    try {
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeName: newStoreName.trim(),
          storeUrl: newStoreUrl.trim() || undefined,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setNewStoreName('')
        setNewStoreUrl('')
        setShowAddForm(false)
        await fetchStores() // 一覧を再取得
        alert('ストアが追加されました')
      } else {
        alert(`ストアの追加に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('ストア追加中にエラー:', error)
      alert('ストアの追加中にエラーが発生しました')
    }
  }

  // ストアをクローリング
  const crawlStore = async (storeId: string, storeName: string) => {
    setCrawling(storeId)
    
    try {
      const response = await fetch(`/api/stores/${storeId}/crawl`, {
        method: 'POST',
      })

      const data = await response.json()
      
      setCrawlResults(prev => ({
        ...prev,
        [storeId]: data
      }))

      if (data.success) {
        await fetchStores() // 一覧を再取得
        
        // 実際のクローリングはCLIスクリプトで実行されることを通知
        if (data.note) {
          alert(`${data.message}\n\n${data.note}\n\nCLIスクリプトでクローリングを実行してください:\nnpm run ebay:crawl ${storeName}`)
        } else {
          alert(`ストア「${storeName}」のクローリングが完了しました！\n新商品: ${data.result.productsNew}件\n売れた商品: ${data.result.productsSold}件`)
        }
      } else {
        alert(`ストア「${storeName}」のクローリングに失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('クローリング中にエラー:', error)
      alert('クローリング中にエラーが発生しました')
    } finally {
      setCrawling(null)
    }
  }

  // 商品一覧ページに遷移
  const viewProducts = (storeId: string) => {
    window.location.href = `/stores/${storeId}/products`
  }

  // ストアを購読
  const subscribeToStore = async (storeId: string, storeName: string) => {
    try {
      const response = await fetch(`/api/stores/${storeId}/subscribe`, {
        method: 'POST',
      })

      const data = await response.json()
      
      if (data.success) {
        await fetchStores() // 一覧を再取得
        alert(`ストア「${storeName}」の購読を開始しました`)
      } else {
        alert(`ストア「${storeName}」の購読に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('購読中にエラー:', error)
      alert('購読中にエラーが発生しました')
    }
  }

  // ストアの購読を解除
  const unsubscribeFromStore = async (storeId: string, storeName: string) => {
    if (!confirm(`ストア「${storeName}」の購読を解除しますか？`)) {
      return
    }

    try {
      const response = await fetch(`/api/stores/${storeId}/subscribe`, {
        method: 'DELETE',
      })

      const data = await response.json()
      
      if (data.success) {
        await fetchStores() // 一覧を再取得
        alert(`ストア「${storeName}」の購読を解除しました`)
      } else {
        alert(`ストア「${storeName}」の購読解除に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('購読解除中にエラー:', error)
      alert('購読解除中にエラーが発生しました')
    }
  }

  useEffect(() => {
    fetchStores()
  }, [])

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">eBayストア管理</h1>
              <p className="mt-2 text-gray-600">ストアの監視と商品管理を行います</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              ストアを追加
            </button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ストア一覧 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">登録済みストア</h2>
          </div>
          
          {stores.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">まだストアが登録されていません</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                最初のストアを追加
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ストア名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      商品数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終クロール
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      購読
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stores.map((store) => (
                    <tr key={store.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {store.storeName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {store.storeUrl}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {store.productCount}件
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {store.lastCrawledAt 
                          ? new Date(store.lastCrawledAt).toLocaleString('ja-JP')
                          : '未実行'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          store.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {store.isActive ? 'アクティブ' : '非アクティブ'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {store.isSubscribed ? (
                          <button
                            onClick={() => unsubscribeFromStore(store.id, store.storeName)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800"
                            title="購読を解除"
                          >
                            <XMarkIcon className="h-4 w-4 mr-1" />
                            購読中
                          </button>
                        ) : (
                          <button
                            onClick={() => subscribeToStore(store.id, store.storeName)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-red-600"
                            title="購読を開始"
                          >
                            <HeartIcon className="h-4 w-4 mr-1" />
                            未購読
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => crawlStore(store.id, store.storeName)}
                          disabled={crawling === store.id}
                          className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white ${
                            crawling === store.id
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {crawling === store.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                              実行中
                            </>
                          ) : (
                            <>
                              <PlayIcon className="h-3 w-3 mr-1" />
                              クロール
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => viewProducts(store.id)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <EyeIcon className="h-3 w-3 mr-1" />
                          商品一覧
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* クロール結果表示 */}
        {Object.keys(crawlResults).length > 0 && (
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">クロール結果</h2>
            </div>
            <div className="px-6 py-4">
              {Object.entries(crawlResults).map(([storeId, result]) => {
                const store = stores.find(s => s.id === storeId)
                return (
                  <div key={storeId} className="mb-4 p-4 border rounded-lg">
                    <h3 className="font-medium text-gray-900">
                      {store?.storeName || storeId}
                    </h3>
                    {result.success && result.result ? (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">商品数:</span>
                          <span className="ml-2 font-medium">{result.result.productsFound}件</span>
                        </div>
                        <div>
                          <span className="text-gray-500">新商品:</span>
                          <span className="ml-2 font-medium text-green-600">{result.result.productsNew}件</span>
                        </div>
                        <div>
                          <span className="text-gray-500">更新:</span>
                          <span className="ml-2 font-medium text-blue-600">{result.result.productsUpdated}件</span>
                        </div>
                        <div>
                          <span className="text-gray-500">売れた:</span>
                          <span className="ml-2 font-medium text-red-600">{result.result.productsSold}件</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-red-600">
                        エラー: {result.error}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ストア追加モーダル */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">新しいストアを追加</h3>
              <form onSubmit={addStore}>
                <div className="mb-4">
                  <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-2">
                    ストア名 *
                  </label>
                  <input
                    type="text"
                    id="storeName"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="例: fsoushop"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="storeUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    ストアURL (任意)
                  </label>
                  <input
                    type="url"
                    id="storeUrl"
                    value={newStoreUrl}
                    onChange={(e) => setNewStoreUrl(e.target.value)}
                    placeholder="例: https://www.ebay.com/str/fsoushop"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    追加
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

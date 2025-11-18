'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BellIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline'

interface NotificationSettings {
  id: string
  emailEnabled: boolean
  lineEnabled: boolean
  lineNotifyToken: string | null
  notifyOnNewProduct: boolean
  notifyOnPriceChange: boolean
  notifyOnSold: boolean
  notifyOnQuantityChange: boolean
}

interface Notification {
  id: string
  type: 'EMAIL' | 'LINE'
  subject: string
  message: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // 通知設定を取得
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings')
      const data = await response.json()
      
      if (data.success) {
        setSettings(data.settings)
      } else {
        console.error('通知設定の取得に失敗:', data.error)
        alert(`通知設定の取得に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('通知設定の取得中にエラー:', error)
      alert('通知設定の取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 通知履歴を取得
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications/history?limit=50')
      const data = await response.json()
      
      if (data.success) {
        setNotifications(data.notifications)
      } else {
        console.error('通知履歴の取得に失敗:', data.error)
      }
    } catch (error) {
      console.error('通知履歴の取得中にエラー:', error)
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchNotifications()
  }, [])

  // 通知設定を更新
  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    if (!settings) return

    setSaving(true)
    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()
      
      if (data.success) {
        setSettings(data.settings)
        alert('通知設定を更新しました')
      } else {
        alert(`通知設定の更新に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('通知設定更新中にエラー:', error)
      alert('通知設定の更新中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'FAILED':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'PENDING':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'SENT':
        return '送信済み'
      case 'FAILED':
        return '送信失敗'
      case 'PENDING':
        return '送信待ち'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-red-600">通知設定の取得に失敗しました</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BellIcon className="h-8 w-8 mr-3 text-yellow-600" />
            通知設定
          </h1>
          <p className="text-gray-600 mt-2">商品の売上や価格変動などの通知を管理します</p>
        </div>

        {/* 通知方法の設定 */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">通知方法</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* メール通知 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <EnvelopeIcon className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">メール通知</div>
                  <div className="text-sm text-gray-500">メールアドレスに通知を送信します</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailEnabled}
                  onChange={(e) => updateSettings({ emailEnabled: e.target.checked })}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* LINE通知 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-600 mr-3" />
                <div>
                  <div className="font-medium text-gray-900">LINE通知</div>
                  <div className="text-sm text-gray-500">LINE Notifyで通知を送信します</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.lineEnabled}
                  onChange={(e) => updateSettings({ lineEnabled: e.target.checked })}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* LINE Notifyトークン */}
            {settings.lineEnabled && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LINE Notifyトークン
                </label>
                <input
                  type="text"
                  value={settings.lineNotifyToken || ''}
                  onChange={(e) => updateSettings({ lineNotifyToken: e.target.value })}
                  disabled={saving}
                  placeholder="LINE Notifyのトークンを入力してください"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  <a href="https://notify-bot.line.me/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                    LINE Notify
                  </a>
                  でトークンを取得してください
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 通知タイプの設定 */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">通知タイプ</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* 新商品の通知 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">新商品の通知</div>
                <div className="text-sm text-gray-500">新しい商品が追加されたときに通知します</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnNewProduct}
                  onChange={(e) => updateSettings({ notifyOnNewProduct: e.target.checked })}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* 価格変動の通知 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">価格変動の通知</div>
                <div className="text-sm text-gray-500">商品の価格が変更されたときに通知します</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnPriceChange}
                  onChange={(e) => updateSettings({ notifyOnPriceChange: e.target.checked })}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* 売上確定の通知 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">売上確定の通知</div>
                <div className="text-sm text-gray-500">商品が売れたことが確定したときに通知します</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnSold}
                  onChange={(e) => updateSettings({ notifyOnSold: e.target.checked })}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* 在庫変動の通知 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">在庫変動の通知</div>
                <div className="text-sm text-gray-500">商品の在庫数が変更されたときに通知します</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnQuantityChange}
                  onChange={(e) => updateSettings({ notifyOnQuantityChange: e.target.checked })}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 通知履歴 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">通知履歴</h2>
            <button
              onClick={() => {
                setShowHistory(!showHistory)
                if (!showHistory) {
                  fetchNotifications()
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showHistory ? '閉じる' : '表示'}
            </button>
          </div>
          {showHistory && (
            <div className="p-6">
              {notifications.length === 0 ? (
                <div className="text-center text-gray-500 py-8">通知履歴がありません</div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            {notification.type === 'EMAIL' ? (
                              <EnvelopeIcon className="h-5 w-5 text-blue-600 mr-2" />
                            ) : (
                              <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600 mr-2" />
                            )}
                            <span className="font-medium text-gray-900">{notification.subject}</span>
                            <span className="ml-3 text-sm text-gray-500">
                              {new Date(notification.createdAt).toLocaleString('ja-JP')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {notification.message}
                          </div>
                          {notification.errorMessage && (
                            <div className="text-sm text-red-600">
                              エラー: {notification.errorMessage}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center ml-4">
                          {getStatusIcon(notification.status)}
                          <span className="ml-2 text-sm text-gray-600">
                            {getStatusText(notification.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CogIcon, UserIcon, EnvelopeIcon, KeyIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  updatedAt: string
}

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')

  // フォーム状態
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // ユーザー情報を取得
  const fetchUser = async () => {
    try {
      const response = await fetch('/api/user')
      const data = await response.json()
      
      if (data.success) {
        setUser(data.user)
        setName(data.user.name)
        setEmail(data.user.email)
      } else {
        console.error('ユーザー情報の取得に失敗:', data.error)
        alert(`ユーザー情報の取得に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('ユーザー情報の取得中にエラー:', error)
      alert('ユーザー情報の取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  // プロフィール情報を更新
  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !email.trim()) {
      alert('名前とメールアドレスは必須です')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim()
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setUser(data.user)
        // セッションを更新
        await update()
        alert('プロフィール情報を更新しました')
      } else {
        alert(`プロフィール情報の更新に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('プロフィール情報更新中にエラー:', error)
      alert('プロフィール情報の更新中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  // パスワードを変更
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('すべてのフィールドを入力してください')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('新しいパスワードと確認用パスワードが一致しません')
      return
    }

    if (newPassword.length < 8) {
      alert('パスワードは8文字以上である必要があります')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/user', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword,
          currentPassword
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        alert('パスワードを変更しました')
      } else {
        alert(`パスワードの変更に失敗しました: ${data.error}`)
      }
    } catch (error) {
      console.error('パスワード変更中にエラー:', error)
      alert('パスワードの変更中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-1980 mx-auto">
          <div className="text-center">読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-1980 mx-auto">
          <div className="text-center text-red-600">ユーザー情報の取得に失敗しました</div>
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
            <CogIcon className="h-8 w-8 mr-3 text-gray-600" />
            設定
          </h1>
          <p className="text-gray-600 mt-2">アカウント設定とセキュリティを管理します</p>
        </div>

        {/* タブ */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserIcon className="h-5 w-5 inline mr-2" />
                プロフィール
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'password'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <KeyIcon className="h-5 w-5 inline mr-2" />
                パスワード
              </button>
            </nav>
          </div>
        </div>

        {/* プロフィール設定 */}
        {activeTab === 'profile' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">プロフィール情報</h2>
            </div>
            <form onSubmit={updateProfile} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  名前
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  メールアドレス
                </label>
                <div className="flex items-center">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={saving}
                    required
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center mb-2">
                  <ShieldCheckIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700">アカウント情報</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>ユーザーID: {user.id}</div>
                  <div>ロール: {user.role === 'ADMIN' ? '管理者' : '一般ユーザー'}</div>
                  <div>登録日: {new Date(user.createdAt).toLocaleString('ja-JP')}</div>
                  <div>最終更新: {new Date(user.updatedAt).toLocaleString('ja-JP')}</div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* パスワード変更 */}
        {activeTab === 'password' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">パスワード変更</h2>
            </div>
            <form onSubmit={changePassword} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  現在のパスワード
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={saving}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  新しいパスワード
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={saving}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">8文字以上である必要があります</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  新しいパスワード（確認）
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={saving}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '変更中...' : 'パスワードを変更'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}


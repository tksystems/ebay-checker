// Jestのセットアップファイル
import '@testing-library/jest-dom'

// 環境変数の設定
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_db'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// コンソールエラーを抑制（テスト中の不要なエラーを非表示）
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('認証エラー:') ||
       args[0].includes('ユーザー登録エラー:') ||
       args[0].includes('ユーザー情報取得エラー:') ||
       args[0].includes('ユーザー情報更新エラー:'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

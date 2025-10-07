import { userService, UserWithRole } from "./userService"

export interface AuthCredentials {
  email: string
  password: string
}

export interface AuthResult {
  success: boolean
  user?: UserWithRole
  error?: string
}

export class AuthService {
  /**
   * ユーザー認証（ログイン）
   */
  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      const { email, password } = credentials

      if (!email || !password) {
        return {
          success: false,
          error: "メールアドレスとパスワードは必須です"
        }
      }

      const user = await userService.authenticateUser(email, password)

      if (!user) {
        return {
          success: false,
          error: "メールアドレスまたはパスワードが正しくありません"
        }
      }

      return {
        success: true,
        user
      }
    } catch (error) {
      console.error("認証エラー:", error)
      return {
        success: false,
        error: "認証中にエラーが発生しました"
      }
    }
  }

  /**
   * ユーザー登録
   */
  async register(userData: {
    name: string
    email: string
    password: string
  }): Promise<AuthResult> {
    try {
      const { name, email, password } = userData

      if (!name || !email || !password) {
        return {
          success: false,
          error: "名前、メールアドレス、パスワードは必須です"
        }
      }

      // メールアドレスの形式チェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return {
          success: false,
          error: "有効なメールアドレスを入力してください"
        }
      }

      // パスワードの強度チェック
      if (password.length < 8) {
        return {
          success: false,
          error: "パスワードは8文字以上で入力してください"
        }
      }

      const user = await userService.createUser({
        name,
        email,
        password
      })

      return {
        success: true,
        user
      }
    } catch (error) {
      console.error("ユーザー登録エラー:", error)
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: false,
        error: "ユーザー登録中にエラーが発生しました"
      }
    }
  }

  /**
   * ユーザー情報取得
   */
  async getUserById(id: string): Promise<UserWithRole | null> {
    try {
      return await userService.findById(id)
    } catch (error) {
      console.error("ユーザー情報取得エラー:", error)
      return null
    }
  }

  /**
   * ユーザー情報更新
   */
  async updateUser(id: string, data: {
    name?: string
    email?: string
    password?: string
  }): Promise<AuthResult> {
    try {
      const user = await userService.updateUser(id, data)

      return {
        success: true,
        user
      }
    } catch (error) {
      console.error("ユーザー情報更新エラー:", error)
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: false,
        error: "ユーザー情報更新中にエラーが発生しました"
      }
    }
  }
}

// シングルトンインスタンス
export const authService = new AuthService()

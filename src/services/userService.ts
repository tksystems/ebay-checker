import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export interface CreateUserData {
  name: string
  email: string
  password: string
  role?: UserRole
}

export interface UserWithRole {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export class UserService {
  /**
   * メールアドレスでユーザーを検索
   */
  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    })
  }

  /**
   * ユーザーIDでユーザーを検索
   */
  async findById(id: string) {
    return await prisma.user.findUnique({
      where: { id }
    })
  }

  /**
   * メールアドレスの重複チェック
   */
  async isEmailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email)
    return user !== null
  }

  /**
   * パスワードのハッシュ化
   */
  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12)
  }

  /**
   * パスワードの検証
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword)
  }

  /**
   * 新規ユーザー登録（トランザクション処理）
   */
  async createUser(userData: CreateUserData): Promise<UserWithRole> {
    const { name, email, password, role = UserRole.CUSTOMER } = userData

    // メールアドレスの重複チェック
    if (await this.isEmailExists(email)) {
      throw new Error("このメールアドレスは既に使用されています")
    }

    // パスワードのハッシュ化
    const hashedPassword = await this.hashPassword(password)

    // トランザクションでユーザー作成と通知設定作成
    const result = await prisma.$transaction(async (tx) => {
      // ユーザー作成
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role
        }
      })

      // 通知設定の初期化
      await tx.notificationSettings.create({
        data: {
          userId: user.id,
          emailEnabled: true,
          lineEnabled: false,
          notifyOnNewProduct: true,
          notifyOnPriceChange: true,
          notifyOnSold: true,
          notifyOnQuantityChange: true
        }
      })

      return user
    })

    return {
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }
  }

  /**
   * ユーザー認証（ログイン用）
   */
  async authenticateUser(email: string, password: string): Promise<UserWithRole | null> {
    const user = await this.findByEmail(email)

    if (!user || !user.password) {
      return null
    }

    const isPasswordValid = await this.verifyPassword(password, user.password)

    if (!isPasswordValid) {
      return null
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  }

  /**
   * ユーザー情報更新
   */
  async updateUser(id: string, data: Partial<CreateUserData>): Promise<UserWithRole> {
    const updateData: Record<string, unknown> = { ...data }

    // パスワードが含まれている場合はハッシュ化
    if (data.password) {
      updateData.password = await this.hashPassword(data.password)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData
    })

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  }

  /**
   * ユーザー削除
   */
  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id }
    })
  }
}

// シングルトンインスタンス
export const userService = new UserService()

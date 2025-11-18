import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { authService } from "@/services/authService"

// ユーザー情報を取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: "認証が必要です" 
        },
        { status: 401 }
      )
    }

    const user = await authService.getUserById(session.user.id)
    
    if (!user) {
      return NextResponse.json(
        { 
          success: false,
          error: "ユーザーが見つかりません" 
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    })
  } catch (error) {
    console.error("ユーザー情報取得エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "ユーザー情報の取得に失敗しました" 
      },
      { status: 500 }
    )
  }
}

// ユーザー情報を更新
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: "認証が必要です" 
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, email, password, currentPassword } = body

    // パスワード変更の場合は現在のパスワードを確認
    if (password) {
      if (!currentPassword) {
        return NextResponse.json(
          { 
            success: false,
            error: "現在のパスワードを入力してください" 
          },
          { status: 400 }
        )
      }

      // 現在のパスワードを確認
      const user = await authService.getUserById(session.user.id)
      if (!user) {
        return NextResponse.json(
          { 
            success: false,
            error: "ユーザーが見つかりません" 
          },
          { status: 404 }
        )
      }

      // パスワード認証（ここでは簡易的に実装、実際にはuserServiceのauthenticateUserを使用）
      const { userService } = await import('@/services/userService')
      const authenticatedUser = await userService.authenticateUser(user.email, currentPassword)
      
      if (!authenticatedUser) {
        return NextResponse.json(
          { 
            success: false,
            error: "現在のパスワードが正しくありません" 
          },
          { status: 400 }
        )
      }
    }

    const result = await authService.updateUser(session.user.id, {
      name,
      email,
      password
    })

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error 
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: result.user
    })
  } catch (error) {
    console.error("ユーザー情報更新エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "ユーザー情報の更新に失敗しました" 
      },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from "next/server"
import { authService } from "@/services/authService"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    const result = await authService.register({
      name,
      email,
      password
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        message: "ユーザー登録が完了しました", 
        userId: result.user!.id 
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    )
  }
}
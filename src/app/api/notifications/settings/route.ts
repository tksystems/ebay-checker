import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// 通知設定を取得
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

    // 通知設定を取得（存在しない場合は作成）
    let settings = await prisma.notificationSettings.findUnique({
      where: { userId: session.user.id }
    })

    // 通知設定が存在しない場合は作成
    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: {
          userId: session.user.id,
          emailEnabled: true,
          lineEnabled: false,
          notifyOnNewProduct: true,
          notifyOnPriceChange: true,
          notifyOnSold: true,
          notifyOnQuantityChange: true
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error("通知設定取得エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "通知設定の取得に失敗しました" 
      },
      { status: 500 }
    )
  }
}

// 通知設定を更新
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
    const {
      emailEnabled,
      lineEnabled,
      lineNotifyToken,
      notifyOnNewProduct,
      notifyOnPriceChange,
      notifyOnSold,
      notifyOnQuantityChange
    } = body

    // 通知設定を更新（存在しない場合は作成）
    const updateData: Prisma.NotificationSettingsUpdateInput = {}
    if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled
    if (lineEnabled !== undefined) updateData.lineEnabled = lineEnabled
    if (lineNotifyToken !== undefined) updateData.lineNotifyToken = lineNotifyToken || null
    if (notifyOnNewProduct !== undefined) updateData.notifyOnNewProduct = notifyOnNewProduct
    if (notifyOnPriceChange !== undefined) updateData.notifyOnPriceChange = notifyOnPriceChange
    if (notifyOnSold !== undefined) updateData.notifyOnSold = notifyOnSold
    if (notifyOnQuantityChange !== undefined) updateData.notifyOnQuantityChange = notifyOnQuantityChange

    const settings = await prisma.notificationSettings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        emailEnabled: emailEnabled ?? true,
        lineEnabled: lineEnabled ?? false,
        lineNotifyToken: lineNotifyToken ?? null,
        notifyOnNewProduct: notifyOnNewProduct ?? true,
        notifyOnPriceChange: notifyOnPriceChange ?? true,
        notifyOnSold: notifyOnSold ?? true,
        notifyOnQuantityChange: notifyOnQuantityChange ?? true
      }
    })
    
    return NextResponse.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error("通知設定更新エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "通知設定の更新に失敗しました" 
      },
      { status: 500 }
    )
  }
}


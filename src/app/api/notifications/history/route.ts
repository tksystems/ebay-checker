import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma, NotificationStatus } from "@prisma/client"

// 型ガード: 文字列が有効なNotificationStatusかチェック
function isValidNotificationStatus(value: string): value is NotificationStatus {
  const validStatuses: readonly NotificationStatus[] = [
    NotificationStatus.PENDING,
    NotificationStatus.SENT,
    NotificationStatus.FAILED
  ]
  return validStatuses.includes(value as NotificationStatus)
}

// 通知履歴を取得
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const statusParam = searchParams.get('status') // PENDING, SENT, FAILED

    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id
    }

    // 有効なNotificationStatus値かチェック
    if (statusParam && isValidNotificationStatus(statusParam)) {
      where.status = statusParam
    }

    // 通知履歴を取得
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.notification.count({ where })
    ])
    
    return NextResponse.json({
      success: true,
      notifications,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error("通知履歴取得エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "通知履歴の取得に失敗しました" 
      },
      { status: 500 }
    )
  }
}


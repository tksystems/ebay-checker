import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ストアを購読
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
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

    const { storeId } = await params

    if (!storeId) {
      return NextResponse.json(
        { 
          success: false,
          error: "ストアIDは必須です" 
        },
        { status: 400 }
      )
    }

    // 既存の購読をチェック
    const existingSubscription = await prisma.subscription.findUnique({
      where: {
        userId_storeId: {
          userId: session.user.id,
          storeId
        }
      }
    })

    let subscriptionId: string

    if (existingSubscription) {
      if (existingSubscription.isActive) {
        return NextResponse.json(
          { 
            success: false,
            error: "既にこのストアを購読しています" 
          },
          { status: 400 }
        )
      } else {
        // 非アクティブな購読を再アクティブ化
        const subscription = await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: { isActive: true }
        })
        subscriptionId = subscription.id
      }
    } else {
      // 新しい購読を作成
      const subscription = await prisma.subscription.create({
        data: {
          userId: session.user.id,
          storeId,
          isActive: true
        }
      })
      subscriptionId = subscription.id
    }
    
    return NextResponse.json({
      success: true,
      subscriptionId,
      message: "ストアの購読を開始しました"
    })
  } catch (error) {
    console.error("ストア購読エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "ストアの購読に失敗しました" 
      },
      { status: 500 }
    )
  }
}

// ストアの購読を解除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
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

    const { storeId } = await params

    if (!storeId) {
      return NextResponse.json(
        { 
          success: false,
          error: "ストアIDは必須です" 
        },
        { status: 400 }
      )
    }

    const subscription = await prisma.subscription.findUnique({
      where: {
        userId_storeId: {
          userId: session.user.id,
          storeId
        }
      }
    })

    if (!subscription) {
      return NextResponse.json(
        { 
          success: false,
          error: "このストアを購読していません" 
        },
        { status: 404 }
      )
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { isActive: false }
    })
    
    return NextResponse.json({
      success: true,
      message: "ストアの購読を解除しました"
    })
  } catch (error) {
    console.error("ストア購読解除エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "ストアの購読解除に失敗しました" 
      },
      { status: 500 }
    )
  }
}

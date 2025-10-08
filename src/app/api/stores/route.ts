import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// ストア一覧を取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const stores = await prisma.store.findMany({
      include: {
        _count: {
          select: { products: true }
        },
        subscriptions: userId ? {
          where: { userId, isActive: true }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedStores = stores.map(store => ({
      id: store.id,
      storeName: store.storeName,
      storeUrl: store.storeUrl,
      isActive: store.isActive,
      lastCrawledAt: store.lastCrawledAt,
      productCount: store._count.products,
      isSubscribed: userId ? store.subscriptions.length > 0 : false,
      subscriptionId: userId && store.subscriptions.length > 0 ? store.subscriptions[0].id : undefined
    }))
    
    return NextResponse.json({
      success: true,
      stores: formattedStores
    })
  } catch (error) {
    console.error("ストア一覧取得エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: "ストア一覧の取得に失敗しました" 
      },
      { status: 500 }
    )
  }
}

// 新しいストアを追加
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('Session data:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userName: session?.user?.name,
      userRole: session?.user?.role
    })
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: "認証が必要です",
          debug: {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id
          }
        },
        { status: 401 }
      )
    }

    const { storeName, storeUrl } = await request.json()

    if (!storeName) {
      return NextResponse.json(
        { 
          success: false,
          error: "ストア名は必須です" 
        },
        { status: 400 }
      )
    }

    // ストアIDを生成（eBayのストア名から）
    const storeId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    // ストアを追加
    const store = await prisma.store.create({
      data: {
        storeId,
        storeName,
        storeUrl: storeUrl || `https://www.ebay.com/str/${storeId}`,
        isActive: true
      }
    })
    
    // ユーザーがストアを購読
    const subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id,
        storeId: store.id,
        isActive: true
      }
    })
    
    return NextResponse.json({
      success: true,
      storeId: store.id,
      subscriptionId: subscription.id,
      message: "ストアが追加され、購読を開始しました"
    }, { status: 201 })
  } catch (error) {
    console.error("ストア追加エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "ストアの追加に失敗しました" 
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CrawlLogStatus } from "@prisma/client"

// ストアのクローリングを開始（非同期実行）
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

    // ストアが存在するかチェック
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    })

    if (!store) {
      return NextResponse.json(
        { 
          success: false,
          error: "ストアが見つかりません" 
        },
        { status: 404 }
      )
    }

    // クロールログを作成（進行中として）
    const crawlLog = await prisma.crawlLog.create({
      data: {
        storeId: store.id,
        status: CrawlLogStatus.PARTIAL,
        productsFound: 0,
        productsNew: 0,
        productsUpdated: 0,
        productsSold: 0,
        startedAt: new Date()
      }
    })

    // 非同期でクローリングを実行（バックグラウンド）
    // 実際のクローリングはCLIスクリプトで実行
    console.log(`ストア ${storeId} のクローリングを開始しました (ログID: ${crawlLog.id})`)
    
    return NextResponse.json({
      success: true,
      message: "クローリングを開始しました",
      logId: crawlLog.id,
      note: "実際のクローリングはCLIスクリプトで実行されます"
    })
  } catch (error) {
    console.error("クローリング開始エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: "クローリングの開始に失敗しました" 
      },
      { status: 500 }
    )
  }
}

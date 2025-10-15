import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// ストアの商品一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!storeId) {
      return NextResponse.json(
        { 
          success: false,
          error: "ストアIDは必須です" 
        },
        { status: 400 }
      )
    }

    const products = await prisma.product.findMany({
      where: { storeId },
      orderBy: [
        { soldAt: 'desc' }, // 売れた商品を優先的に表示
        { lastSeenAt: 'desc' }
      ],
      take: limit,
      skip: offset
    })

    const formattedProducts = products.map(product => ({
      id: product.id,
      title: product.title,
      price: Number(product.price),
      currency: product.currency,
      status: product.status,
      lastSeenAt: product.lastSeenAt,
      soldAt: product.soldAt
    }))
    
    return NextResponse.json({
      success: true,
      products: formattedProducts,
      pagination: {
        limit,
        offset,
        count: formattedProducts.length
      }
    })
  } catch (error) {
    console.error("商品一覧取得エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: "商品一覧の取得に失敗しました" 
      },
      { status: 500 }
    )
  }
}

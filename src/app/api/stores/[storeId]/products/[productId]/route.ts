import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// 特定の商品詳細を取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; productId: string }> }
) {
  try {
    const { storeId, productId } = await params

    if (!storeId || !productId) {
      return NextResponse.json(
        { 
          success: false,
          error: "ストアIDと商品IDは必須です" 
        },
        { status: 400 }
      )
    }

    // 商品を取得（ストアIDも確認）
    const product = await prisma.product.findFirst({
      where: { 
        id: productId,
        storeId: storeId
      }
    })

    if (!product) {
      return NextResponse.json(
        { 
          success: false,
          error: "商品が見つかりません" 
        },
        { status: 404 }
      )
    }

    const formattedProduct = {
      id: product.id,
      title: product.title,
      price: Number(product.price),
      currency: product.currency,
      status: product.status,
      listingUrl: product.listingUrl,
      imageUrl: product.imageUrl,
      condition: product.condition,
      quantity: product.quantity,
      ebayItemId: product.ebayItemId,
      lastSeenAt: product.lastSeenAt,
      soldAt: product.soldAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }
    
    return NextResponse.json({
      success: true,
      product: formattedProduct
    })
  } catch (error) {
    console.error("商品詳細取得エラー:", error)
    return NextResponse.json(
      { 
        success: false,
        error: "商品詳細の取得に失敗しました" 
      },
      { status: 500 }
    )
  }
}

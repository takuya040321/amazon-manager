import { NextRequest } from "next/server";
import { ProductApiHandler } from "@/lib/api/base-api-handler";
import { standardApiMiddleware } from "@/lib/api/middleware";
import { getProductRepository } from "@/lib/database/repositories";
import { OperationResponseUtils } from "@/lib/api/response-utils";

interface UpdateProductRequest {
  is_hidden?: boolean;
  name?: string;
  price?: number;
  sale_price?: number;
  display_order?: number;
  memo?: string;
}

class ProductUpdateHandler extends ProductApiHandler {
  async handleRequest(
    request: NextRequest,
    params: { id: string },
    middlewareData?: any
  ): Promise<any> {
    try {
      const productId = params.id;
      
      // ミドルウェアからサニタイズ済みデータを取得、なければ直接読み取り
      let body: UpdateProductRequest;
      if (middlewareData?.body) {
        body = middlewareData.body;
      } else {
        body = await request.json();
      }
      
      const productRepo = getProductRepository();

      // 商品存在確認
      await this.validateProductExists(productId);

      // 更新フィールドの構築
      const updateData: any = {};
      
      if (body.is_hidden !== undefined) {
        console.log(`🔧 商品非表示状態更新: ${productId}, is_hidden: ${body.is_hidden}`);
        updateData.is_hidden = body.is_hidden;
      }
      if (body.name !== undefined) {
        updateData.name = body.name;
      }
      if (body.price !== undefined) {
        updateData.price = body.price;
      }
      if (body.sale_price !== undefined) {
        updateData.sale_price = body.sale_price;
      }
      if (body.display_order !== undefined) {
        updateData.display_order = body.display_order;
      }
      if (body.memo !== undefined) {
        updateData.memo = body.memo;
      }

      if (Object.keys(updateData).length === 0) {
        return this.createValidationErrorResponse("更新するフィールドが指定されていません");
      }

      // 商品更新
      const updatedProduct = await productRepo.update(productId, updateData);

      console.log(`✅ 商品を更新しました: ${updatedProduct.name}`);

      return OperationResponseUtils.productUpdated(updatedProduct);
      
    } catch (error) {
      console.error("❌ 商品更新エラー:", error);
      if (error instanceof Error && error.message.includes("見つかりません")) {
        return this.createErrorResponse("NOT_FOUND", "指定された商品が見つかりません", 404);
      }
      return this.createErrorResponse("INTERNAL_ERROR", "システムエラーが発生しました", 500);
    }
  }
}

class ProductDeleteHandler extends ProductApiHandler {
  async handleRequest(
    request: NextRequest,
    params: { id: string },
    middlewareData?: any
  ): Promise<any> {
    try {
      const productId = params.id;
      const productRepo = getProductRepository();

      // 商品存在確認と取得
      const product = await this.validateProductExists(productId);

      // 商品削除
      await productRepo.delete(productId);

      console.log(`✅ 商品を削除しました: ${product.name}`);

      return OperationResponseUtils.productDeleted(product);
      
    } catch (error) {
      console.error("❌ 商品削除エラー:", error);
      if (error instanceof Error && error.message.includes("見つかりません")) {
        return this.createErrorResponse("NOT_FOUND", "指定された商品が見つかりません", 404);
      }
      return this.createErrorResponse("INTERNAL_ERROR", "システムエラーが発生しました", 500);
    }
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const middleware = standardApiMiddleware();
  const middlewareResult = await middleware.execute(request);
  
  if (!middlewareResult.success) {
    return middlewareResult.response!;
  }

  const handler = new ProductUpdateHandler();
  return handler.execute(request, resolvedParams, middlewareResult.data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const middleware = standardApiMiddleware();
  const middlewareResult = await middleware.execute(request);
  
  if (!middlewareResult.success) {
    return middlewareResult.response!;
  }

  const handler = new ProductDeleteHandler();
  return handler.execute(request, resolvedParams);
}
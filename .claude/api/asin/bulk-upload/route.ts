import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { FileUploadApiHandler } from "@/lib/api/base-api-handler";
import { fileUploadApiMiddleware } from "@/lib/api/middleware";
import { getAsinRepository } from "@/lib/database/repositories";
import { OperationResponseUtils } from "@/lib/api/response-utils";
import { validateASIN } from "@/lib/utils/validation";

class AsinBulkUploadHandler extends FileUploadApiHandler {
  async handleRequest(request: NextRequest): Promise<any> {
    const startTime = Date.now();
    
    console.log("📂 ASIN一括登録開始（統一システム対応）");
    const formData = await request.formData();
    const file = formData.get("file") as File;

    // ファイルバリデーション
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"
    ];
    this.validateFile(file, allowedTypes);

    console.log(`📁 ASINファイルの処理を開始: ${file.name}`);

    // ファイル解析とデータ変換
    const { asinDataList, errors, totalRows } = await this.parseKeepaFile(file);

    // エラーがある場合は全件エラーとする
    if (errors.length > 0) {
      console.error(`❌ ASINファイル解析エラー: ${errors.length}件`);
      return OperationResponseUtils.asinBulkUpload(0, totalRows, errors);
    }

    // データベースに一括登録
    const asinRepo = getAsinRepository();
    console.log(`📝 データベース一括登録開始: ${asinDataList.length}件`);
    
    try {
      await asinRepo.bulkUpsert(asinDataList);
    } catch (error) {
      console.error("❌ ASIN一括登録データベースエラー:", error);
      return OperationResponseUtils.asinBulkUpload(0, totalRows, [{
        row: 0,
        error: `データベース操作に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`
      }]);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ ASIN一括登録完了 (${duration}ms): ${asinDataList.length}件`);

    return OperationResponseUtils.asinBulkUpload(
      asinDataList.length,
      totalRows,
      [],
      duration
    );
  }

  // Keepaファイルの解析処理
  private async parseKeepaFile(file: File): Promise<{
    asinDataList: any[];
    errors: Array<{ row: number; error: string }>;
    totalRows: number;
  }> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Keepaファイルはヘッダーがないため、配列として取得
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const asinDataList: any[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    // Keepaファイル形式のカラム定義（新品出品者数・新品価格は使用しない）
    // 0: 画像, 1: URL: Amazon, 2: ブランド, 3: 商品名, 4: ASIN, 
    // 5: 先月の購入, 6: Buy Box 現在価格, 7: 新品出品者数（未使用）, 
    // 8: 紹介料％, 9: 新品: 現在価格（未使用）, 10: FBA Pick&Pack 料金, 11: 商品コード: EAN

    // 1行目はヘッダーなので2行目から処理
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      const rowNumber = i + 1;

      try {
        // 空行スキップ
        if (!row || row.length === 0 || !row[4]) {
          continue;
        }

        const asin = String(row[4] || "").trim();
        const amazonTitle = String(row[3] || "").trim();

        // 必須項目チェック
        if (!asin || !amazonTitle) {
          errors.push({
            row: rowNumber,
            error: "ASIN（列E）と商品名（列D）は必須です"
          });
          continue;
        }

        // ASIN形式チェック
        if (!validateASIN(asin)) {
          errors.push({
            row: rowNumber,
            error: "ASIN形式が正しくありません（10桁の英数字である必要があります）"
          });
          continue;
        }

        // データ変換
        const asinData = this.parseKeepaRow(row, asin, amazonTitle);
        asinDataList.push(asinData);

      } catch (error) {
        errors.push({
          row: rowNumber,
          error: `データ変換エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
        });
      }
    }

    return {
      asinDataList,
      errors,
      totalRows: rawData.length
    };
  }

  // Keepaファイルの行データを解析
  private parseKeepaRow(row: any[], asin: string, amazonTitle: string): any {
    // 価格データの解析（Buy Box価格のみ使用）
    const buyBoxPrice = parseFloat(String(row[6] || "").replace(/[^\d.-]/g, "")) || null;
    const amazonPrice = buyBoxPrice;

    // 紹介料の解析（CSVでは小数点形式で格納されているため100倍）
    const sellingFeeRateText = String(row[8] || "").replace(/[^\d.-]/g, "");
    let sellingFeeRate = parseFloat(sellingFeeRateText) || null;
    
    // CSVの値は小数点形式（0.1 = 10%）のため100倍してパーセンテージに変換
    if (sellingFeeRate !== null) {
      sellingFeeRate = sellingFeeRate * 100;
    }

    // FBA手数料の解析
    const fbaFeeText = String(row[10] || "").replace(/[^\d.-]/g, "");
    const fbaFee = parseFloat(fbaFeeText) || null;

    // 先月の購入数
    const monthlySales = parseInt(String(row[5] || "").replace(/[^\d]/g, "")) || null;

    // EANコードの解析
    const eanCodesText = String(row[11] || "").trim();
    const eanCodes = eanCodesText ? eanCodesText.split(/[,;\s]+/).filter(code => code.length > 0) : [];

    return {
      asin: asin.toUpperCase(),
      amazon_title: amazonTitle,
      amazon_url: String(row[1] || "") || `https://amazon.co.jp/dp/${asin}`,
      amazon_image_url: String(row[0] || "") || null,
      amazon_price: amazonPrice,
      monthly_sales: monthlySales,
      selling_fee_rate: sellingFeeRate,
      fba_fee: fbaFee,
      ean_codes: eanCodes,
      brand: String(row[2] || "").trim() || null,
      memo: null,
      keepa_imported_at: new Date().toISOString()
    };
  }
}

export async function POST(request: NextRequest) {
  const middleware = fileUploadApiMiddleware();
  const middlewareResult = await middleware.execute(request);
  
  if (!middlewareResult.success) {
    return middlewareResult.response!;
  }

  const handler = new AsinBulkUploadHandler();
  return handler.execute(request);
}
import { NextRequest, NextResponse } from "next/server";
import { unifiedSupabase } from "@/lib/database/unified-supabase";

interface UpdateAsinRequest {
  has_amazon?: boolean;
  has_official?: boolean;
  complaint_count?: number;
  is_hazardous?: boolean;
  no_partner_carrier?: boolean;
  hidden?: boolean;
  memo?: string;
  amazon_price?: number;
  monthly_sales?: number;
  selling_fee_rate?: number;
  fba_fee?: number;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ asin: string }> }
) {
  try {
    const { asin } = await params;
    const updates: UpdateAsinRequest = await request.json();
    
    console.log(`🔧 ASIN更新リクエスト: ${asin}`, updates);

    // ASINフォーマットの検証
    if (!asin || asin.length !== 10 || !/^[A-Z0-9]{10}$/.test(asin)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "INVALID_ASIN", 
            message: "ASINは10桁の英数字である必要があります" 
          } 
        },
        { status: 400 }
      );
    }

    // 更新データの検証
    const allowedFields = [
      "has_amazon",
      "has_official", 
      "complaint_count",
      "is_hazardous",
      "no_partner_carrier",
      "hidden",
      "memo",
      "amazon_price",
      "monthly_sales",
      "selling_fee_rate",
      "fba_fee"
    ];

    const updateData: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        // 数値フィールドの検証
        if (key === "complaint_count") {
          if (value !== null && value !== undefined) {
            const numValue = Number(value);
            if (isNaN(numValue) || numValue < 0 || !Number.isInteger(numValue)) {
              return NextResponse.json(
                { 
                  success: false, 
                  error: { 
                    code: "INVALID_COMPLAINT_COUNT", 
                    message: "苦情回数は0以上の整数である必要があります" 
                  } 
                },
                { status: 400 }
              );
            }
            updateData[key] = numValue;
          }
        } else if (key === "amazon_price" || key === "monthly_sales" || key === "fba_fee") {
          if (value !== null && value !== undefined) {
            const numValue = Number(value);
            if (isNaN(numValue) || numValue < 0) {
              return NextResponse.json(
                { 
                  success: false, 
                  error: { 
                    code: "INVALID_NUMBER", 
                    message: `${key}は0以上の数値である必要があります` 
                  } 
                },
                { status: 400 }
              );
            }
            updateData[key] = numValue;
          }
        } else if (key === "selling_fee_rate") {
          if (value !== null && value !== undefined) {
            const numValue = Number(value);
            if (isNaN(numValue) || numValue < 0 || numValue > 100) {
              return NextResponse.json(
                { 
                  success: false, 
                  error: { 
                    code: "INVALID_PERCENTAGE", 
                    message: "手数料率は0-100%の範囲で入力してください" 
                  } 
                },
                { status: 400 }
              );
            }
            updateData[key] = numValue;
          }
        } else {
          updateData[key] = value;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      console.log(`❌ 更新フィールドなし: ${asin}`, { updates, allowedFields });
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "NO_UPDATES", 
            message: "更新するフィールドが指定されていません" 
          } 
        },
        { status: 400 }
      );
    }
    
    console.log("✅ 更新データ:", updateData);

    // 更新日時を設定
    updateData.updated_at = new Date().toISOString();

    // データベース更新（ASIN情報が存在しない場合は新規作成）
    const supabase = await unifiedSupabase.getClient();
    
    // まず既存のASIN情報をチェック
    const { error: checkError } = await supabase
      .from("asin_info")
      .select("asin")
      .eq("asin", asin)
      .single();

    let data, error;
    
    if (checkError && checkError.code === "PGRST116") {
      // ASIN情報が存在しない場合は新規作成
      console.log(`ASIN情報が存在しないため新規作成: ${asin}`);
      
      const newAsinData = {
        asin: asin,
        amazon_title: `手動登録 ${asin}`,
        amazon_url: `https://amazon.co.jp/dp/${asin}`,
        amazon_image_url: null,
        amazon_price: null,
        monthly_sales: null,
        selling_fee_rate: null,
        fba_fee: null,
        ean_codes: [],
        brand: null,
        memo: null,
        hidden: false,
        has_amazon: false,
        has_official: false,
        complaint_count: 0,
        is_hazardous: false,
        no_partner_carrier: false,
        keepa_imported_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...updateData
      };
      
      const result = await supabase
        .from("asin_info")
        .insert(newAsinData)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else if (checkError) {
      // その他のエラー
      error = checkError;
    } else {
      // 既存データを更新
      const result = await supabase
        .from("asin_info")
        .update(updateData)
        .eq("asin", asin)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("ASIN情報更新/作成エラー:", error);
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: "UPDATE_FAILED", 
            message: "ASIN情報の更新/作成に失敗しました",
            details: error.message 
          } 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        asin: data.asin,
        updatedFields: Object.keys(updateData).filter(key => key !== "updated_at"),
        updatedAt: data.updated_at
      },
      message: "ASIN情報が正常に更新されました"
    });

  } catch (error) {
    console.error("ASIN更新API エラー:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: "INTERNAL_ERROR", 
          message: "内部サーバーエラーが発生しました" 
        } 
      },
      { status: 500 }
    );
  }
}
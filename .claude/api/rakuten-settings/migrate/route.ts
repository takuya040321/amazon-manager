import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

// 楽天ショップ設定テーブルを手動作成する緊急用エンドポイント
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    
    // テーブル作成SQL
    const createTableSQL = `
      -- 楽天ショップ設定テーブル
      CREATE TABLE IF NOT EXISTS rakuten_shop_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        shop_code TEXT NOT NULL,
        genre_id TEXT,
        keyword TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- インデックス
      CREATE INDEX IF NOT EXISTS idx_rakuten_shop_configs_shop_name ON rakuten_shop_configs(shop_name);
      CREATE INDEX IF NOT EXISTS idx_rakuten_shop_configs_is_active ON rakuten_shop_configs(is_active);
      
      -- 更新日時自動更新関数
      CREATE OR REPLACE FUNCTION update_rakuten_shop_configs_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- トリガー
      DROP TRIGGER IF EXISTS trigger_update_rakuten_shop_configs_updated_at ON rakuten_shop_configs;
      CREATE TRIGGER trigger_update_rakuten_shop_configs_updated_at
        BEFORE UPDATE ON rakuten_shop_configs
        FOR EACH ROW
        EXECUTE FUNCTION update_rakuten_shop_configs_updated_at();
    `;

    // テーブルが存在するかチェック
    const { error: tableError } = await supabase.from("rakuten_shop_configs").select("id").limit(1);
    
    if (tableError && (tableError.code === "42P01" || tableError.message.includes("does not exist"))) {
      return NextResponse.json({
        success: false,
        error: "楽天ショップ設定テーブルが存在しません。以下のSQLをSupabaseダッシュボードのSQL Editorで実行してください。",
        sqlScript: createTableSQL,
        instructions: [
          "1. Supabaseダッシュボードにログイン",
          "2. SQL Editorを開く", 
          "3. 提供されたSQLスクリプトを実行",
          "4. このページをリロード"
        ]
      }, { status: 503 });
    }

    // 初期データ挿入
    const { error: insertError } = await supabase
      .from("rakuten_shop_configs")
      .upsert([
        {
          shop_name: "muji",
          display_name: "無印良品 楽天市場店",
          shop_code: "mujirushi-ryohin",
          genre_id: "100939",
          keyword: null,
          is_active: true
        }
      ], { onConflict: "shop_name" });

    if (insertError) {
      console.warn("初期データ挿入エラー:", insertError);
    }

    return NextResponse.json({
      success: true,
      message: "楽天ショップ設定テーブルを作成しました"
    });

  } catch (error) {
    console.error("マイグレーション実行エラー:", error);
    return NextResponse.json({
      success: false,
      error: `マイグレーション実行に失敗しました: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 });
  }
}
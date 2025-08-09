import { NextRequest } from "next/server";
import { getSupabaseClient, supabaseManager } from "@/lib/database";

export async function GET() {
  try {
    const supabase = await getSupabaseClient();
    
    const { data: proxySettings, error } = await supabase
      .from("proxy_settings")
      .select("*")
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      throw new Error(error.message);
    }

    const config = proxySettings ? {
      enabled: true,
      url: proxySettings.proxy_url,
      username: proxySettings.username || "",
      password: "" // セキュリティのため空文字で返す
    } : {
      enabled: false,
      url: "",
      username: "",
      password: ""
    };

    return Response.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error("❌ プロキシ設定取得エラー:", error);
    return Response.json({
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "プロキシ設定の取得に失敗しました"
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { enabled, url, username, password } = await request.json();

    const supabase = await getSupabaseClient();

    if (enabled) {
      // URLバリデーション
      if (!url) {
        return Response.json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "プロキシURLは必須です"
          }
        }, { status: 400 });
      }

      // 既存の設定を無効化
      await supabase
        .from("proxy_settings")
        .update({ is_active: false })
        .eq("is_active", true);

      // 新しい設定を保存
      const { error: insertError } = await supabase
        .from("proxy_settings")
        .insert([{
          name: "Default Proxy",
          proxy_url: url,
          username: username || null,
          password_encrypted: password || null, // 実際は暗号化が必要
          is_active: true
        }]);

      if (insertError) {
        throw new Error(insertError.message);
      }

      console.log("✅ プロキシ設定を保存しました");
      
      // プロキシマネージャーの設定を動的更新
      await supabaseManager.updateProxySettings({
        proxyUrl: url,
        username: username || undefined,
        password: password || undefined
      });
    } else {
      // プロキシ無効化
      await supabase
        .from("proxy_settings")
        .update({ is_active: false })
        .eq("is_active", true);

      console.log("✅ プロキシ設定を無効化しました");
      
      // プロキシマネージャーのプロキシを無効化
      await supabaseManager.updateProxySettings({});
    }

    return Response.json({
      success: true,
      message: "プロキシ設定を保存しました"
    });

  } catch (error) {
    console.error("❌ プロキシ設定保存エラー:", error);
    return Response.json({
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "プロキシ設定の保存に失敗しました"
      }
    }, { status: 500 });
  }
}
import { ImageResponse } from "next/og";

export const alt = "サブスク診断 — 隠れた無駄を見つけよう";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #eff6ff 0%, #fef2f2 50%, #fffbeb 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 16,
            display: "flex",
          }}
        >
          サブスク診断
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#374151",
            marginBottom: 48,
            display: "flex",
          }}
        >
          クレジットカード明細からサブスクの無駄を見つけます
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              background: "#fef2f2",
              border: "2px solid #fca5a5",
              borderRadius: 12,
              fontSize: 24,
              color: "#dc2626",
              fontWeight: 600,
            }}
          >
            Apple税を検出
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              background: "#fffbeb",
              border: "2px solid #fde68a",
              borderRadius: 12,
              fontSize: 24,
              color: "#d97706",
              fontWeight: 600,
            }}
          >
            重複サブスクを発見
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 24px",
              background: "#eff6ff",
              border: "2px solid #93c5fd",
              borderRadius: 12,
              fontSize: 24,
              color: "#2563eb",
              fontWeight: 600,
            }}
          >
            36+サービス対応
          </div>
        </div>

        {/* Privacy badge */}
        <div
          style={{
            fontSize: 22,
            color: "#6b7280",
            display: "flex",
          }}
        >
          完全無料・ブラウザ内完結・サーバー送信なし
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 20,
            color: "#3b82f6",
            fontWeight: 600,
            display: "flex",
          }}
        >
          subscription-doctor.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}

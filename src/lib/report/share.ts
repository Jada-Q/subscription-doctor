import type { Report } from "./types";
import { gradeEmoji } from "./score";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/**
 * Generate a share card as a PNG data URL.
 * 1200×630 matches Twitter/OGP recommended dimensions.
 * Shows only score and savings — no service details for privacy.
 */
export function generateShareCard(report: Report): string {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bgColor =
    report.grade === "green"
      ? "#f0fdf4"
      : report.grade === "yellow"
        ? "#fffbeb"
        : "#fef2f2";
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 32);
  ctx.fill();

  // Border
  const borderColor =
    report.grade === "green"
      ? "#86efac"
      : report.grade === "yellow"
        ? "#fde68a"
        : "#fca5a5";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 32);
  ctx.stroke();

  // Title
  ctx.fillStyle = "#1f2937";
  ctx.font = "bold 48px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("サブスク診断結果", CARD_WIDTH / 2, 90);

  // Score circle
  const cx = CARD_WIDTH / 2;
  const cy = 270;
  const r = 110;

  // Score ring background
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 14;
  ctx.stroke();

  // Score ring fill
  const scoreAngle = (report.score / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + scoreAngle);
  ctx.strokeStyle =
    report.grade === "green"
      ? "#22c55e"
      : report.grade === "yellow"
        ? "#eab308"
        : "#ef4444";
  ctx.lineWidth = 14;
  ctx.stroke();

  // Score number
  ctx.fillStyle = "#111827";
  ctx.font = "bold 72px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${report.score}`, cx, cy);

  // Grade label
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(`/ 100`, cx, cy + 44);

  // Stats line
  const statsY = 450;
  ctx.font = "32px sans-serif";
  ctx.fillStyle = "#374151";
  ctx.textAlign = "center";

  const emoji = gradeEmoji(report.grade);
  const cardInfo = report.cardCount >= 2 ? `（${report.cardCount}枚のカード）` : "";
  const dupInfo = report.crossCardDuplicates.length > 0
    ? ` / カード横断重複: ${report.crossCardDuplicates.length}件`
    : "";
  ctx.fillText(
    `${emoji} ${report.totalCount}件のサブスクを検出${cardInfo}${dupInfo}`,
    CARD_WIDTH / 2,
    statsY
  );

  // Savings
  if (report.savingsAnnual > 0) {
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = "#dc2626";
    ctx.fillText(
      `年間 ¥${report.savingsAnnual.toLocaleString()} 節約できる可能性`,
      CARD_WIDTH / 2,
      statsY + 60
    );
  } else {
    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#16a34a";
    ctx.fillText("無駄なし！最適化されています", CARD_WIDTH / 2, statsY + 60);
  }

  // Footer with APP URL
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#3b82f6";
  ctx.fillText(
    "🔍 subscription-doctor.vercel.app",
    CARD_WIDTH / 2,
    CARD_HEIGHT - 56
  );
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "#9ca3af";
  ctx.fillText(
    "無料でサブスクの無駄を診断しよう",
    CARD_WIDTH / 2,
    CARD_HEIGHT - 24
  );

  return canvas.toDataURL("image/png");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

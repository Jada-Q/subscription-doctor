"use client";

import type { MatchedTransaction } from "@/lib/matcher";
import type { Report } from "@/lib/report";

// Categories treated as essential fixed costs (not discretionary subscriptions)
const ESSENTIAL_CATEGORIES = new Set(["internet", "mobile"]);

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    cloud_storage: "クラウド",
    streaming: "動画配信",
    music: "音楽",
    shopping: "ショッピング",
    ai_tools: "AI",
    productivity: "生産性",
    internet: "インターネット回線",
    gaming: "ゲーム",
    media: "メディア",
    developer: "開発",
    bundle: "バンドル",
    security: "セキュリティ",
    security_home: "ホームセキュリティ",
    dating: "マッチング",
    mobile: "携帯電話",
    health: "健康",
    finance: "家計",
    communication: "通信",
    education: "教育",
    entertainment: "エンタメ",
    food_delivery: "食品宅配",
    insurance: "保険",
  };
  return labels[category] || category;
}

function ItemCard({
  item,
  isMultiCard,
  essential,
}: {
  item: MatchedTransaction;
  isMultiCard: boolean;
  essential: boolean;
}) {
  const cheaperAlts = (item.matchedRule?.alternatives ?? []).filter(
    (alt) => alt.price > 0 && alt.price < item.amount
  );

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={essential ? { borderColor: "#d1d5db", backgroundColor: "#f9fafb" } : undefined}
    >
      <div className="flex justify-between items-center p-3">
        <div>
          <div className="font-medium flex items-center gap-1">
            {essential && (
              <span className="text-xs px-1.5 py-0.5 rounded font-normal"
                style={{ backgroundColor: "#e5e7eb", color: "#6b7280" }}>
                固定費
              </span>
            )}
            {item.matchedService}
          </div>
          <div className="text-xs text-gray-500">
            {isMultiCard && item.cardIndex !== undefined && (
              <span className="inline-block px-1 py-0.5 bg-gray-100 rounded text-xs mr-1">
                カード{item.cardIndex + 1}
              </span>
            )}
            {item.date !== "unknown" && <span>{item.date}</span>}
            {item.matchedRule?.category && (
              <span>
                {item.date !== "unknown" ? " ・ " : ""}
                {categoryLabel(item.matchedRule.category)}
              </span>
            )}
          </div>
        </div>
        <div className="font-medium">¥{item.amount.toLocaleString()}</div>
      </div>
      {item.matchedRule?.advice && (
        <div className="px-3 pb-3">
          <div className="p-2 bg-blue-50 rounded text-xs text-blue-800">
            <span className="font-medium">💡 </span>
            {item.matchedRule.advice}
          </div>
          {cheaperAlts.length > 0 ? (
            <div className="mt-1.5 space-y-1">
              {cheaperAlts.map((alt, j) => (
                <div key={j} className="flex justify-between text-xs text-gray-600 px-1">
                  <span>
                    {alt.name}{" "}
                    <span className="text-gray-400">({alt.note})</span>
                  </span>
                  <span className="text-green-600 font-medium">
                    ¥{alt.price.toLocaleString()}/月
                  </span>
                </div>
              ))}
            </div>
          ) : (item.matchedRule?.alternatives ?? []).length > 0 ? (
            <div className="mt-1.5 text-xs text-green-700 px-1 font-medium">
              現在の料金は他社と比べてお得です
            </div>
          ) : null}
          {item.matchedRule?.cancelUrl && (
            <div className="mt-1.5">
              <a
                href={item.matchedRule.cancelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-red-600 hover:text-red-800 underline px-1"
              >
                {essential ? "プラン見直しはこちら →" : "解約手続きはこちら →"}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SubscriptionList({ report }: { report: Report }) {
  const isMultiCard = report.cardCount >= 2;
  const matched = report.allTransactions.filter((m) => m.matchedService);
  if (matched.length === 0) return null;

  const essential = matched.filter(
    (m) => m.matchedRule && ESSENTIAL_CATEGORIES.has(m.matchedRule.category)
  );
  const optimizable = matched.filter(
    (m) => !m.matchedRule || !ESSENTIAL_CATEGORIES.has(m.matchedRule.category)
  );

  const essentialTotal = essential.reduce((sum, m) => sum + m.amount, 0);
  const optimizableTotal = optimizable.reduce((sum, m) => sum + m.amount, 0);
  const total = essentialTotal + optimizableTotal;

  return (
    <section className="space-y-6">
      {/* Optimizable subscriptions */}
      {optimizable.length > 0 && (
        <div>
          <h2 className="font-bold text-lg mb-2">最適化可能なサブスク</h2>
          <div className="space-y-3">
            {optimizable.map((item, i) => (
              <ItemCard key={i} item={item} isMultiCard={isMultiCard} essential={false} />
            ))}
          </div>
          <div className="mt-3 flex justify-between items-center p-3 bg-gray-50 rounded-lg font-medium">
            <span>小計（{optimizable.length}件）</span>
            <span>¥{optimizableTotal.toLocaleString()}/月</span>
          </div>
        </div>
      )}

      {/* Essential fixed costs */}
      {essential.length > 0 && (
        <div>
          <h2 className="font-bold text-lg mb-2" style={{ color: "#6b7280" }}>
            🏠 基礎固定費
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            インターネット・携帯など生活インフラ。解約より<strong>プランの見直し</strong>で節約できる場合があります。
          </p>
          <div className="space-y-3">
            {essential.map((item, i) => (
              <ItemCard key={i} item={item} isMultiCard={isMultiCard} essential={true} />
            ))}
          </div>
          <div className="mt-3 flex justify-between items-center p-3 rounded-lg font-medium"
            style={{ backgroundColor: "#f3f4f6" }}>
            <span>小計（{essential.length}件）</span>
            <span>¥{essentialTotal.toLocaleString()}/月</span>
          </div>
        </div>
      )}

      {/* Grand total */}
      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg font-medium border-t-2 border-gray-200">
        <span>月額合計（{matched.length}件）</span>
        <span className="text-lg">¥{total.toLocaleString()}/月</span>
      </div>
    </section>
  );
}

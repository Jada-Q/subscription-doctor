"use client";

import type { MatchedTransaction } from "@/lib/matcher";
import type { Report } from "@/lib/report";

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    cloud_storage: "クラウド",
    streaming: "動画配信",
    music: "音楽",
    shopping: "ショッピング",
    ai_tools: "AI",
    productivity: "生産性",
    internet: "インターネット",
    gaming: "ゲーム",
    media: "メディア",
    developer: "開発",
    bundle: "バンドル",
    security: "セキュリティ",
    security_home: "ホームセキュリティ",
    dating: "マッチング",
    mobile: "携帯",
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

export function SubscriptionList({ report }: { report: Report }) {
  const isMultiCard = report.cardCount >= 2;
  const matched = report.allTransactions.filter((m) => m.matchedService);
  if (matched.length === 0) return null;

  const total = matched.reduce((sum, m) => sum + m.amount, 0);

  return (
    <section>
      <h2 className="font-bold text-lg mb-2">検出されたサブスク</h2>
      <div className="space-y-3">
        {matched.map((item: MatchedTransaction, i: number) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <div className="flex justify-between items-center p-3">
              <div>
                <div className="font-medium">{item.matchedService}</div>
                <div className="text-xs text-gray-500">
                  {isMultiCard && item.cardIndex !== undefined && (
                    <span className="inline-block px-1 py-0.5 bg-gray-100 rounded text-xs mr-1">カード{item.cardIndex + 1}</span>
                  )}
                  {item.date !== "unknown" && <span>{item.date}</span>}
                  {item.matchedRule?.category && (
                    <span>{item.date !== "unknown" ? " ・ " : ""}{categoryLabel(item.matchedRule.category)}</span>
                  )}
                </div>
              </div>
              <div className="font-medium">
                ¥{item.amount.toLocaleString()}
              </div>
            </div>
            {item.matchedRule?.advice && (
              <div className="px-3 pb-3">
                <div className="p-2 bg-blue-50 rounded text-xs text-blue-800">
                  <span className="font-medium">💡 </span>
                  {item.matchedRule.advice}
                </div>
                {(() => {
                  const cheaperAlts = (item.matchedRule?.alternatives ?? []).filter(
                    (alt) => alt.price > 0 && alt.price < item.amount
                  );
                  if (cheaperAlts.length > 0) {
                    return (
                      <div className="mt-1.5 space-y-1">
                        {cheaperAlts.map((alt, j) => (
                          <div key={j} className="flex justify-between text-xs text-gray-600 px-1">
                            <span>{alt.name} <span className="text-gray-400">({alt.note})</span></span>
                            <span className="text-green-600 font-medium">
                              ¥{alt.price.toLocaleString()}/月
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if ((item.matchedRule?.alternatives ?? []).length > 0) {
                    return (
                      <div className="mt-1.5 text-xs text-green-700 px-1 font-medium">
                        現在の料金は他社と比べてお得です
                      </div>
                    );
                  }
                  return null;
                })()}
                {item.matchedRule?.cancelUrl && (
                  <div className="mt-1.5">
                    <a
                      href={item.matchedRule.cancelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-red-600 hover:text-red-800 underline px-1"
                    >
                      解約手続きはこちら →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between items-center p-3 bg-gray-50 rounded-lg font-medium">
        <span>サブスク月額合計（{matched.length}件）</span>
        <span className="text-lg">¥{total.toLocaleString()}/月</span>
      </div>
    </section>
  );
}

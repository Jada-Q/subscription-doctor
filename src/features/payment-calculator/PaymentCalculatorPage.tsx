"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PAYMENT_TEMPLATES,
  MERCHANT_CATEGORIES,
  type PaymentMethod,
  type MerchantCategory,
} from "./data/templates";
import { calculateBestPayment, type RankedResult } from "./lib/calculate";
import { loadOwnedIds, saveOwnedIds } from "./lib/storage";

type View = "setup" | "calculator";

export default function PaymentCalculatorPage() {
  const [view, setView] = useState<View>("setup");
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<MerchantCategory | null>(null);
  const [amount, setAmount] = useState("");
  const [results, setResults] = useState<RankedResult[] | null>(null);

  // Load saved owned cards on mount
  useEffect(() => {
    const saved = loadOwnedIds();
    if (saved.length > 0) {
      setOwnedIds(new Set(saved));
      setView("calculator");
    }
  }, []);

  const toggleOwned = useCallback((id: string) => {
    setOwnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const confirmSetup = useCallback(() => {
    saveOwnedIds(Array.from(ownedIds));
    setView("calculator");
  }, [ownedIds]);

  const calculate = useCallback(() => {
    if (!category || !amount) return;
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0) return;

    const allMethods: PaymentMethod[] = PAYMENT_TEMPLATES;
    const ranked = calculateBestPayment(category, amt, allMethods, ownedIds);
    setResults(ranked);
  }, [category, amount, ownedIds]);

  const resetCalc = useCallback(() => {
    setCategory(null);
    setAmount("");
    setResults(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b px-4 py-3">
        <h1 className="text-xl font-bold">今日の支払い</h1>
        <p className="text-sm text-gray-500">
          どのカードで払えば一番お得か計算します
        </p>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4">
        {view === "setup" && (
          <div className="mt-6 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold mb-2">持っているカードを選択</h2>
              <p className="text-sm text-gray-500">
                あとから変更できます
              </p>
            </div>

            <div className="space-y-3">
              {PAYMENT_TEMPLATES.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleOwned(card.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                    ownedIds.has(card.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={{ touchAction: "manipulation" }}
                >
                  <div
                    className="w-10 h-7 rounded flex-shrink-0"
                    style={{ backgroundColor: card.color }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{card.name}</div>
                    <div className="text-xs text-gray-500">
                      基本還元 {(card.baseRate * 100).toFixed(1)}%
                      {card.categoryRates.length > 0 && (
                        <span>
                          {" "}/ 最大{" "}
                          {(
                            Math.max(
                              card.baseRate,
                              ...card.categoryRates.map((cr) => cr.rate)
                            ) * 100
                          ).toFixed(1)}
                          %
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xl">
                    {ownedIds.has(card.id) ? "✓" : ""}
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={confirmSetup}
              disabled={ownedIds.size === 0}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                ownedIds.size > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              {ownedIds.size > 0
                ? `${ownedIds.size}枚のカードで始める`
                : "カードを選択してください"}
            </button>
          </div>
        )}

        {view === "calculator" && !results && (
          <div className="mt-6 space-y-6">
            {/* Category Selection */}
            <div>
              <h2 className="font-bold mb-3">どこで買い物？</h2>
              <div className="grid grid-cols-4 gap-2">
                {MERCHANT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${
                      category === cat.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    style={{ touchAction: "manipulation" }}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-xs font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            {category && (
              <div>
                <h2 className="font-bold mb-3">いくら？</h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      ¥
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="1000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") calculate();
                      }}
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={calculate}
                    disabled={!amount || parseInt(amount, 10) <= 0}
                    className={`px-6 py-3 rounded-lg font-medium ${
                      amount && parseInt(amount, 10) > 0
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                    style={{ touchAction: "manipulation" }}
                  >
                    計算
                  </button>
                </div>
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {[500, 1000, 3000, 5000, 10000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmount(String(v))}
                      className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                      style={{ touchAction: "manipulation" }}
                    >
                      ¥{v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Settings link */}
            <button
              type="button"
              onClick={() => setView("setup")}
              className="text-sm text-gray-400 underline hover:text-gray-600"
              style={{ touchAction: "manipulation" }}
            >
              カード設定を変更
            </button>
          </div>
        )}

        {view === "calculator" && results && (
          <div className="mt-4 space-y-4">
            {/* Result Header */}
            <div className="text-center text-sm text-gray-500">
              {MERCHANT_CATEGORIES.find((c) => c.id === category)?.label} で ¥
              {parseInt(amount, 10).toLocaleString()} の買い物
            </div>

            {/* Best Card */}
            {results.length > 0 && (
              <div
                className="p-5 rounded-xl border-2"
                style={{ borderColor: results[0].method.color + "80" }}
              >
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">ベストな支払い</div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div
                      className="w-10 h-7 rounded"
                      style={{ backgroundColor: results[0].method.color }}
                    />
                    <span className="text-lg font-bold">
                      {results[0].method.name}
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    ¥{results[0].cashback.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    還元（{(results[0].effectiveRate * 100).toFixed(1)}% ·{" "}
                    {results[0].rateSources}）
                  </div>
                  {!results[0].isOwned && (
                    <div className="mt-2 text-xs text-amber-600 font-medium">
                      ※ 未所持のカードです
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other Cards */}
            {results.length > 1 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-600">他のカード</h3>
                {results.slice(1).map((r) => (
                  <div
                    key={r.method.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100"
                  >
                    <div
                      className="w-8 h-5 rounded flex-shrink-0"
                      style={{ backgroundColor: r.method.color }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {r.method.name}
                        {!r.isOwned && (
                          <span className="ml-1 text-xs text-gray-400">
                            (未所持)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(r.effectiveRate * 100).toFixed(1)}% · {r.rateSources}
                      </div>
                    </div>
                    <div className="text-sm font-bold">
                      ¥{r.cashback.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Affiliate suggestion */}
            {results.some((r) => !r.isOwned && r.cashback > 0 && r.method.affiliateUrl) && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="text-xs text-gray-500 mb-2">
                  PR · お得なカード情報
                </div>
                {results
                  .filter((r) => !r.isOwned && r.cashback > 0 && r.method.affiliateUrl)
                  .slice(0, 2)
                  .map((r) => (
                    <a
                      key={r.method.id}
                      href={r.method.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-white rounded-lg mb-2 last:mb-0 hover:shadow-sm transition-shadow"
                    >
                      <div
                        className="w-10 h-7 rounded flex-shrink-0"
                        style={{ backgroundColor: r.method.color }}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {r.method.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          この買い物で ¥{r.cashback.toLocaleString()} 還元
                        </div>
                      </div>
                      <span className="text-blue-600 text-sm">詳細 →</span>
                    </a>
                  ))}
              </div>
            )}

            <button
              type="button"
              onClick={resetCalc}
              className="w-full py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              style={{ touchAction: "manipulation" }}
            >
              別の買い物を計算
            </button>
          </div>
        )}
      </main>

      <footer className="border-t px-4 py-3 text-center text-xs text-gray-400">
        還元率は一般的な情報です。実際の還元率はカード会社の最新情報をご確認ください。
      </footer>
    </div>
  );
}

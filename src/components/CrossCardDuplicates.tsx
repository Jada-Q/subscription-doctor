"use client";

import type { CrossCardDuplicate } from "@/lib/report";

export function CrossCardDuplicates({
  duplicates,
}: {
  duplicates: CrossCardDuplicate[];
}) {
  if (duplicates.length === 0) return null;

  return (
    <section>
      <h2 className="font-bold text-lg mb-2 text-purple-600">
        カード横断の重複課金
      </h2>
      <p className="text-sm text-gray-600 mb-3">
        同じサービスが複数のカードで課金されています。1枚に統一すると節約できます。
      </p>
      {duplicates.map((dup, i) => (
        <div key={i} className="p-3 bg-purple-50 rounded-lg mb-2 border border-purple-100">
          <div className="text-sm font-medium text-purple-800">
            {dup.serviceName}
          </div>
          <div className="mt-1 space-y-1">
            {dup.instances.map((inst, j) => (
              <div key={j} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  <span className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-xs mr-1">
                    カード{(inst.cardIndex ?? 0) + 1}
                  </span>
                  {inst.date !== "unknown" && inst.date}
                </span>
                <span className="font-medium">
                  ¥{inst.amount.toLocaleString()}/月
                </span>
              </div>
            ))}
          </div>
          {dup.savingsMonthly > 0 && (
            <div className="mt-2 text-xs text-purple-700 font-medium">
              1枚に統一で月 ¥{dup.savingsMonthly.toLocaleString()} 節約
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

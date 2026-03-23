"use client";

import { categorizeMerchant } from "@/lib/matcher";
import type { MatchedTransaction } from "@/lib/matcher";
import type { Report } from "@/lib/report";

export function UnmatchedTransactions({ report }: { report: Report }) {
  const unmatched = report.allTransactions.filter((m) => !m.matchedService);
  if (unmatched.length === 0) return null;

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
        その他の取引（{unmatched.length}件）
      </summary>
      <div className="mt-2 space-y-1">
        {unmatched.map((item: MatchedTransaction, i: number) => {
          const merchantCat = categorizeMerchant(item.description);
          return (
            <div
              key={i}
              className="flex justify-between items-center p-2 text-gray-500"
            >
              <div>
                <span>{item.description}</span>
                {item.date !== "unknown" && (
                  <span className="text-xs ml-2">{item.date}</span>
                )}
                {merchantCat && (
                  <span className="text-xs ml-2 text-gray-400">・{merchantCat}</span>
                )}
              </div>
              <span>¥{item.amount.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

"use client";

import type { Report } from "@/lib/report";
import { gradeLabel } from "@/lib/report";

export function ScoreCard({ report }: { report: Report }) {
  const gradeColors = {
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-600", ring: "stroke-green-500" },
    yellow: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-600", ring: "stroke-yellow-500" },
    red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", ring: "stroke-red-500" },
  };
  const colors = gradeColors[report.grade];
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (report.score / 100) * circumference;

  return (
    <div className={`p-6 rounded-xl border ${colors.bg} ${colors.border} text-center`}>
      <div className="inline-block relative">
        <svg width="120" height="120" className="-rotate-90">
          <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="45" fill="none"
            className={colors.ring}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${colors.text}`}>{report.score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <div className={`mt-2 text-lg font-bold ${colors.text}`}>
        {gradeLabel(report.grade)}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        {report.matchedCount}件のサブスクを識別
        {report.cardCount >= 2 && (
          <span className="block text-xs mt-0.5">{report.cardCount}枚のカードを分析</span>
        )}
      </div>
    </div>
  );
}

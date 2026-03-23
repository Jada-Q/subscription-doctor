"use client";

export function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg text-center ${highlight ? "bg-red-50" : "bg-gray-50"}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`text-lg font-bold ${highlight ? "text-red-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

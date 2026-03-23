"use client";

export function FeatureCard({
  title,
  description,
  color,
}: {
  title: string;
  description: string;
  color: "red" | "amber" | "blue";
}) {
  const colorMap = {
    red: "border-l-red-400 bg-red-50/50",
    amber: "border-l-amber-400 bg-amber-50/50",
    blue: "border-l-blue-400 bg-blue-50/50",
  };
  return (
    <div className={`p-3 rounded-lg border-l-4 ${colorMap[color]}`}>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{description}</div>
    </div>
  );
}

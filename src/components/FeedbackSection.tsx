"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function FeedbackSection() {
  const [submitted, setSubmitted] = useState<"good" | "bad" | null>(null);
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);

  const handleFeedback = (type: "good" | "bad") => {
    setSubmitted(type);
    console.log("[feedback]", type);
    trackEvent("feedback_submit", { type });
  };

  const handleCommentSubmit = () => {
    if (!comment.trim()) return;
    console.log("[feedback-comment]", submitted, comment);
    setCommentSent(true);
  };

  if (commentSent) {
    return (
      <div className="p-4 bg-green-50 rounded-lg text-center text-sm text-green-700">
        フィードバックありがとうございます！改善に活かします。
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg text-center">
      <p className="text-sm font-medium text-gray-700 mb-2">
        この診断結果は正しいですか？
      </p>
      {!submitted ? (
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => handleFeedback("good")}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-green-50 hover:border-green-300 active:bg-green-100"
            style={{ touchAction: "manipulation" }}
          >
            👍 正しい
          </button>
          <button
            type="button"
            onClick={() => handleFeedback("bad")}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-red-50 hover:border-red-300 active:bg-red-100"
            style={{ touchAction: "manipulation" }}
          >
            👎 間違いがある
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            {submitted === "good"
              ? "ありがとうございます！コメントがあればお聞かせください。"
              : "どこが間違っていましたか？改善の参考にします。"}
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={submitted === "good" ? "（任意）改善の提案など" : "例：Netflix が検出されなかった"}
            className="w-full p-2 border rounded-lg text-sm resize-none h-16"
            maxLength={500}
          />
          <button
            type="button"
            onClick={handleCommentSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            style={{ touchAction: "manipulation" }}
          >
            送信
          </button>
        </div>
      )}
    </div>
  );
}

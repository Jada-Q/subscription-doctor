"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TabNavigator, type TabId } from "@/components";

const SubscriptionDoctor = dynamic(
  () => import("@/features/subscription-doctor"),
  { loading: () => <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>読み込み中...</div> }
);
const PaymentCalculator = dynamic(
  () => import("@/features/payment-calculator"),
  { loading: () => <div style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>読み込み中...</div> }
);

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("doctor");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", paddingBottom: 56 }}>
      <div style={{ display: tab === "doctor" ? "block" : "none", flex: 1 }}>
        <SubscriptionDoctor />
      </div>
      <div style={{ display: tab === "payment" ? "block" : "none", flex: 1 }}>
        <PaymentCalculator />
      </div>
      <TabNavigator active={tab} onChange={setTab} />
    </div>
  );
}

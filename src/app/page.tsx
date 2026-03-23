"use client";

import { useState } from "react";
import { TabNavigator, type TabId } from "@/components";
import SubscriptionDoctorPage from "@/features/subscription-doctor/SubscriptionDoctorPage";
import PaymentCalculatorPage from "@/features/payment-calculator/PaymentCalculatorPage";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("doctor");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", paddingBottom: 56 }}>
      <div style={{ display: tab === "doctor" ? "block" : "none", flex: 1 }}>
        <SubscriptionDoctorPage />
      </div>
      <div style={{ display: tab === "payment" ? "block" : "none", flex: 1 }}>
        <PaymentCalculatorPage />
      </div>
      <TabNavigator active={tab} onChange={setTab} />
    </div>
  );
}

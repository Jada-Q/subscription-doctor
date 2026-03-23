"use client";

export type TabId = "doctor" | "payment";

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: "doctor", label: "診断", icon: "🩺" },
  { id: "payment", label: "支払い", icon: "💳" },
];

interface TabNavigatorProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function TabNavigator({ active, onChange }: TabNavigatorProps) {
  return (
    <nav
      role="tablist"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        borderTop: "1px solid #e5e7eb",
        backgroundColor: "#fff",
        zIndex: 9999,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8px 0",
            minHeight: 52,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: active === tab.id ? "#2563eb" : "#9ca3af",
            fontWeight: active === tab.id ? 700 : 400,
            fontSize: 11,
            touchAction: "manipulation",
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ marginTop: 2 }}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

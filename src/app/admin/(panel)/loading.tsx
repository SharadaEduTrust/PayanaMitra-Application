export default function AdminLoading() {
  return (
    <div style={{ padding: "28px 32px", animation: "fadeIn 0.15s ease-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <div style={{ width: "160px", height: "28px", background: "rgba(74, 59, 42, 0.1)", borderRadius: "6px", marginBottom: "8px" }} />
          <div style={{ width: "240px", height: "16px", background: "rgba(74, 59, 42, 0.06)", borderRadius: "4px" }} />
        </div>
        <div style={{ width: "100px", height: "36px", background: "rgba(74, 59, 42, 0.08)", borderRadius: "8px" }} />
      </div>

      <div
        style={{
          background: "var(--white, #fdfbf9)",
          border: "1px solid var(--line, #e3d5c4)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "40px", background: "rgba(74, 59, 42, 0.05)", borderRadius: "8px" }} />
          <div style={{ width: "140px", height: "40px", background: "rgba(74, 59, 42, 0.05)", borderRadius: "8px" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: "52px",
                background: "rgba(74, 59, 42, 0.03)",
                borderRadius: "8px",
                opacity: 1 - i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

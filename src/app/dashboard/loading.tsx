export default function DashboardLoading() {
  return (
    <div style={{ padding: "28px 32px", animation: "fadeIn 0.15s ease-out" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ width: "120px", height: "14px", background: "rgba(74, 59, 42, 0.08)", borderRadius: "4px", marginBottom: "8px" }} />
        <div style={{ width: "220px", height: "30px", background: "rgba(74, 59, 42, 0.12)", borderRadius: "6px", marginBottom: "8px" }} />
        <div style={{ width: "320px", height: "16px", background: "rgba(74, 59, 42, 0.06)", borderRadius: "4px" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: "180px",
              background: "var(--white, #fdfbf9)",
              border: "1px solid var(--line, #e3d5c4)",
              borderRadius: "16px",
              padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              opacity: 1 - i * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}

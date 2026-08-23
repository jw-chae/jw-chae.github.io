import { ImageResponse } from "next/og";

export const alt = "Joongwon Chae research in anomaly detection and memory-augmented inference";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#24272b",
          padding: "68px 76px",
          fontFamily: "Arial, sans-serif",
          borderTop: "18px solid #701870",
        }}
      >
        <div style={{ display: "flex", color: "#626971", fontSize: 22 }}>Graduate researcher / Tsinghua University SIGS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, width: "92%" }}>
          <div style={{ display: "flex", color: "#14446a", fontSize: 76, fontWeight: 500, letterSpacing: -2 }}>
            Joongwon Chae
          </div>
          <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35 }}>
            Training-free visual systems for anomaly detection, memory-augmented inference, and medical AI.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 20, color: "#626971" }}>
          <span>Memory / Retrieval / Prompting / Routing / Calibration</span>
          <span style={{ color: "#246fbd", fontWeight: 700 }}>jw-chae.github.io</span>
        </div>
      </div>
    ),
    size,
  );
}

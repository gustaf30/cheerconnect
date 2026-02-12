import { ImageResponse } from "next/og";

export const alt = "CheerConnect — A rede social do cheerleading";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, rgb(179, 50, 40) 0%, rgb(120, 30, 25) 100%)",
          fontFamily: "sans-serif",
          color: "white",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          CheerConnect
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            opacity: 0.85,
          }}
        >
          A rede social do cheerleading
        </div>
      </div>
    ),
    { ...size }
  );
}

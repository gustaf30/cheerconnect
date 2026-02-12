import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgb(179, 50, 40)",
          borderRadius: "20%",
          fontSize: 110,
          fontWeight: 800,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        C
      </div>
    ),
    { ...size }
  );
}

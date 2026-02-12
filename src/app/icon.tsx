import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 120,
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

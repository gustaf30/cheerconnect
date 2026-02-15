export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Crops an image using canvas and returns a JPEG Blob.
 * @param imageSrc - Object URL or data URL of the source image
 * @param cropArea - Pixel coordinates from react-easy-crop onCropComplete
 * @param outputSize - Target dimensions (image is scaled to fit)
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropArea: CropArea,
  outputSize?: { width: number; height: number }
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const outW = outputSize?.width ?? cropArea.width;
  const outH = outputSize?.height ?? cropArea.height;
  canvas.width = outW;
  canvas.height = outH;

  // White background (handles transparent PNGs)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outW,
    outH
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      "image/jpeg",
      0.92
    );
  });
}

export function canonicalMediaFolder(ownerId: string): string {
  return `cheerconnect/users/${ownerId}`;
}

export function isCloudinaryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      (!cloudName || url.pathname.startsWith(`/${cloudName}/`))
    );
  } catch {
    return false;
  }
}

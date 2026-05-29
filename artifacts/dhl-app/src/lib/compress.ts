import imageCompression from "browser-image-compression";

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    });
    return new File([compressed], file.name, { type: compressed.type });
  } catch {
    return file;
  }
}

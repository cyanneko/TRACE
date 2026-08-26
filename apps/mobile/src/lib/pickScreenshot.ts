import * as ImagePicker from "expo-image-picker";

const maximumDataUrlLength = 12 * 1024 * 1024;

export type SelectedScreenshot = {
  dataUrl: string;
  fileName: string;
  height: number;
  uri: string;
  width: number;
};

export async function pickScreenshot(): Promise<SelectedScreenshot | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    base64: true,
    mediaTypes: ["images"],
    quality: 1,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset?.base64) {
    throw new Error("The selected screenshot could not be read.");
  }

  const mimeType = normalizeMimeType(asset.mimeType);
  const dataUrl = `data:${mimeType};base64,${asset.base64}`;
  if (dataUrl.length > maximumDataUrlLength) {
    throw new Error("The screenshot is too large. Choose an image under 9 MB.");
  }

  return {
    dataUrl,
    fileName: asset.fileName ?? "chat-screenshot",
    height: asset.height,
    uri: asset.uri,
    width: asset.width,
  };
}

function normalizeMimeType(value?: string | null) {
  if (value === "image/png" || value === "image/gif" || value === "image/webp") {
    return value;
  }
  return "image/jpeg";
}

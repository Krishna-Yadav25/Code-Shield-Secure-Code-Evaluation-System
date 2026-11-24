export function captureFrame(video, maxWidth = 360, quality = 0.6) {
  try {
    if (!video || !video.videoWidth) return null;

    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}
export function fileUriToAbsolutePath(uri: string): string | null {
  const filePrefix = "file://";
  if (!uri.startsWith(filePrefix)) return null;

  const encodedPath = uri.slice(filePrefix.length);
  if (!encodedPath.startsWith("/")) return null;

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

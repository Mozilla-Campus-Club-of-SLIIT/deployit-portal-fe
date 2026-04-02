const LOCAL_API_URL = "http://localhost:8080";

export function getApiBaseUrl() {
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envApiUrl) {
    return envApiUrl;
  }

  if (typeof window !== "undefined") {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalHost) {
      return LOCAL_API_URL;
    }

    return window.location.origin;
  }

  return LOCAL_API_URL;
}
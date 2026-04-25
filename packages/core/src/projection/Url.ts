export function joinEndpointUrl(rootUrl: string, path?: string): string {
  const normalizedRoot = rootUrl.endsWith("/") ? rootUrl.slice(0, -1) : rootUrl;
  const trimmedPath = path?.trim();

  if (!trimmedPath || trimmedPath === "/") {
    return normalizedRoot;
  }

  const normalizedPath = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
  return `${normalizedRoot}${normalizedPath}`;
}

export function splitEndpointUrl(value: string): { rootUrl: string; path?: string } {
  const parsed = new URL(value);
  const trimmedPath = parsed.pathname.replace(/\/+$/, "");

  return {
    rootUrl: parsed.origin,
    ...(trimmedPath && trimmedPath !== "/" ? { path: trimmedPath } : {}),
  };
}

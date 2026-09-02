export type RequestQueryValue = string | string[] | undefined;

export function requestSearchParams(rawUrl: string | undefined): URLSearchParams {
  return new URL(rawUrl ?? "/", "http://localhost").searchParams;
}

export function requestQueryValue(
  searchParams: URLSearchParams,
  name: string
): RequestQueryValue {
  const values = searchParams.getAll(name);
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

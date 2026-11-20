export async function fetchText(url: string) {
  return await (await fetchUrl(url)).text();
}

export async function fetchJson<T = unknown>(
  url: string,
  validator?: { parse: (data: unknown) => T },
): Promise<T> {
  const res = await fetchUrl(url);
  try {
    const parsed = await res.json();
    return validator ? validator.parse(parsed) : (parsed as T);
  } catch (err) {
    throw new Error(`Error parsing JSON from ${url}`, { cause: err });
  }
}

async function fetchUrl(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Error fetching "${url}"`, { cause: err });
  }
  if (!res.ok) {
    throw new Error(`Error fetching "${url}": ${res.status} ${res.statusText}`);
  }
  return res;
}

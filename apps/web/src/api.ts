export const mutationHeaders = { "content-type": "application/json", "x-csrf-token": "1" };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : response.json()) as Promise<T>;
}

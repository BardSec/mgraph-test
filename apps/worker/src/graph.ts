import 'isomorphic-fetch';
import { Client } from '@microsoft/microsoft-graph-client';
import { config } from './config';

let cachedClient: Client | null = null;

async function getAccessToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = config.graph;
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

export async function getGraphClient(): Promise<Client> {
  if (cachedClient) return cachedClient;
  const token = await getAccessToken();
  cachedClient = Client.init({
    authProvider: (done) => done(null, token),
  });
  return cachedClient;
}

export async function graphGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const client = await getGraphClient();
  let url = `https://graph.microsoft.com/v1.0/${path.replace(/^\//, '')}`;
  if (params && Object.keys(params).length > 0) {
    url += '?' + new URLSearchParams(params).toString();
  }
  const res = await client.api(url).get();
  return res as T;
}

/** Paginate with nextLink; calls pageCallback for each page. Stops when no nextLink or pageCallback returns false. */
export async function graphPaginate<T>(
  path: string,
  params: Record<string, string>,
  pageCallback: (items: T[]) => Promise<boolean>
): Promise<void> {
  const client = await getGraphClient();
  let url = `https://graph.microsoft.com/v1.0/${path.replace(/^\//, '')}?${new URLSearchParams(params).toString()}`;
  for (;;) {
    const res = await client.api(url).get() as { value?: T[]; '@odata.nextLink'?: string };
    const items = res.value ?? [];
    const cont = await pageCallback(items);
    if (!cont || !res['@odata.nextLink']) break;
    url = res['@odata.nextLink'];
    await backoff();
  }
}

async function backoff(ms = 1000): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Call Graph with retry on 429 */
export async function graphGetWithRetry<T>(path: string, params?: Record<string, string>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await graphGet<T>(path, params);
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 429 && i < retries - 1) {
        await backoff(2000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
  throw new Error('graphGetWithRetry failed');
}

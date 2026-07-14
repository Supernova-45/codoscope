import type {
  AtlasDocument,
  AtlasRequest,
  ExampleManifest,
  OrganismInfo,
} from '../types/atlas';
import { validateAtlasDocument } from './atlas';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 60_000;

function errorDetail(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const messages = value
      .map((item) => (
        typeof item === 'object'
        && item !== null
        && typeof (item as { msg?: unknown }).msg === 'string'
          ? (item as { msg: string }).msg
          : null
      ))
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join('; ') : null;
  }
  return null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { detail?: unknown } | null;
      throw new Error(errorDetail(body?.detail) ?? `Request failed (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchAtlasDocument(path = 'data/atlas_fixture.json'): Promise<AtlasDocument> {
  const safePath = path.replace(/^\/+/, '');
  const value = await fetchJson(`${import.meta.env.BASE_URL}${safePath}`);
  validateAtlasDocument(value);
  return value;
}

export async function fetchFixture(): Promise<AtlasDocument> {
  return fetchAtlasDocument();
}

export async function fetchExampleManifest(): Promise<ExampleManifest> {
  const value = await fetchJson(`${import.meta.env.BASE_URL}data/examples/index.json`);
  if (
    typeof value !== 'object'
    || value === null
    || (value as ExampleManifest).schema_version !== 'codoscope/examples-1.0'
    || !Array.isArray((value as ExampleManifest).examples)
    || typeof (value as ExampleManifest).default_example !== 'string'
  ) {
    throw new Error('The example manifest has an invalid format');
  }
  return value as ExampleManifest;
}

export async function fetchAtlas(request: AtlasRequest): Promise<AtlasDocument> {
  if (!API_URL) throw new Error('Live inference not configured (VITE_API_URL unset)');
  const value = await fetchJson(`${API_URL}/api/atlas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  validateAtlasDocument(value);
  return value;
}

export async function fetchOrganisms(query = ''): Promise<OrganismInfo[]> {
  if (!API_URL) return [];
  const params = new URLSearchParams({ limit: '100' });
  if (query.trim()) params.set('query', query.trim());
  const value = await fetchJson(`${API_URL}/api/organisms?${params}`);
  if (
    !Array.isArray(value)
    || !value.every((item) => (
      typeof item === 'object'
      && item !== null
      && typeof (item as OrganismInfo).taxid === 'number'
      && typeof (item as OrganismInfo).name === 'string'
    ))
  ) {
    throw new Error('The organism list has an invalid format');
  }
  return value as OrganismInfo[];
}

import type { AtlasDocument, AtlasRequest, OrganismInfo } from '../types/atlas';
import { validateAtlasDocument } from './atlas';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 60_000;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(body?.detail ?? `Request failed (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request timed out. Try a shorter sequence.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchFixture(): Promise<AtlasDocument> {
  const value = await fetchJson(`${import.meta.env.BASE_URL}data/atlas_fixture.json`);
  validateAtlasDocument(value);
  return value;
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

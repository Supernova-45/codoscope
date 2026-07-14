import type { AtlasDocument, AtlasRequest, OrganismInfo } from '../types/atlas';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export async function fetchFixture(): Promise<AtlasDocument> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/atlas_fixture.json`);
  if (!res.ok) throw new Error(`Failed to load fixture: ${res.status}`);
  return res.json();
}

export async function fetchAtlas(request: AtlasRequest): Promise<AtlasDocument> {
  if (!API_URL) throw new Error('Live inference not configured (VITE_API_URL unset)');
  const res = await fetch(`${API_URL}/api/atlas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Inference failed');
  }
  return res.json();
}

export async function fetchOrganisms(): Promise<OrganismInfo[]> {
  if (!API_URL) return [];
  const res = await fetch(`${API_URL}/api/organisms`);
  if (!res.ok) throw new Error('Failed to load organisms');
  return res.json();
}

export function validateSchema(doc: AtlasDocument): void {
  const major = doc.schema_version.split('/')[1]?.split('-')[1]?.split('.')[0];
  if (major !== '1') {
    throw new Error(`Unsupported schema version: ${doc.schema_version}`);
  }
}

import { describe, expect, it } from 'vitest';
import { resolveAssetDisplay, sanitizeString } from './metadata-utils';

describe('metadata-utils', () => {
  it('prefers metadata name and resolves fallback subtitle from symbol', () => {
    const resolved = resolveAssetDisplay({
      isin: 'US0000000001',
      metadata: { name: 'ACME Corp', symbol: 'ACM' },
      activity: { name: 'Legacy Name', symbol: 'LEG' },
      cached: { name: 'Cached Name', symbol: 'CAD' },
    });

    expect(resolved.name).toBe('ACME Corp');
    expect(resolved.source).toBe('csv');
    expect(resolved.symbol).toBe('ACM');
    expect(resolved.subtitle).toBe('ACM');
  });

  it('falls back to isin when no display fields are available', () => {
    const resolved = resolveAssetDisplay({
      isin: 'DE000A1EWWW0',
      metadata: null,
      activity: null,
      cached: null,
    });

    expect(resolved.name).toBe('DE000A1EWWW0');
    expect(resolved.source).toBe('fallback');
    expect(resolved.subtitle).toBe('DE000A1EWWW0');
  });

  it('sanitizes placeholder strings to null', () => {
    expect(sanitizeString(' n/a ')).toBeNull();
    expect(sanitizeString(' undefined ')).toBeNull();
    expect(sanitizeString('Valid')).toBe('Valid');
  });
});

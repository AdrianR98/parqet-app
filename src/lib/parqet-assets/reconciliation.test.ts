import { describe, expect, it } from 'vitest';
import { buildReconciliationWarnings } from './reconciliation';
import type { NormalizedActivity } from './normalization';

function activity(input: Partial<NormalizedActivity>): NormalizedActivity {
  return {
    id: 'a1',
    datetime: '2024-01-01T00:00:00.000Z',
    portfolioId: 'p1',
    portfolioName: 'Demo',
    isin: 'US0000000001',
    name: 'Asset',
    symbol: 'AST',
    wkn: null,
    type: 'buy',
    rawType: 'BUY',
    shares: 1,
    price: 10,
    amount: 10,
    amountNet: 10,
    appliedOverrides: [],
    ...input,
  };
}

describe('buildReconciliationWarnings', () => {
  it('creates exact error and warning payloads when sell volume exceeds buy history', () => {
    const warnings = buildReconciliationWarnings([
      activity({ id: 'b1', type: 'buy', shares: 5 }),
      activity({ id: 's1', datetime: '2024-01-02T00:00:00.000Z', type: 'sell', shares: 8 }),
    ]);

    expect(warnings).toHaveLength(2);
    expect(warnings).toEqual([
      {
        isin: 'US0000000001',
        message: 'Verkauf oder Ausbuchung ohne ausreichenden Vorbestand.',
        severity: 'error',
      },
      {
        isin: 'US0000000001',
        message: 'Mehr Stuecke verkauft als gekauft.',
        severity: 'warning',
      },
    ]);
  });

  it('creates info warning for unknown activity type', () => {
    const warnings = buildReconciliationWarnings([
      activity({ id: 'u1', type: 'unknown', rawType: 'MYSTERY', shares: 0, amount: 0, amountNet: 0, price: 0 }),
    ]);

    expect(warnings).toEqual([
      {
        isin: 'US0000000001',
        message: 'Unbekannter Aktivitaetstyp in der Historie vorhanden.',
        severity: 'info',
      },
    ]);
  });
});

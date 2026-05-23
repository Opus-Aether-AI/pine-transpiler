import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src';

const UNIMPLEMENTED_TA_SCRIPT = `//@version=5
indicator("Unimplemented Gate")
value = ta.foo(close, 14)
plot(value)
`;

const MAPPED_TA_SCRIPT = `//@version=5
indicator("Mapped Gate")
value = ta.sma(close, 14)
plot(value)
`;

describe('unimplemented std-call gate', () => {
  it('rejects unknown ta.* calls by default', () => {
    const result = transpileToPineJS(
      UNIMPLEMENTED_TA_SCRIPT,
      'unimplemented_default',
      'Unimplemented Default',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'Pine function `ta.foo` is not implemented.',
    );
    expect(result.error).toContain('Supported `ta.*`:');
    expect(result.error).toContain('See docs/SUPPORTED_FEATURES.md');
    expect(result.error).toContain('Location: line 3, column 9');
  });

  it('allows best-effort emit when allowUnimplemented=true', () => {
    const result = transpileToPineJS(
      UNIMPLEMENTED_TA_SCRIPT,
      'unimplemented_lenient',
      'Unimplemented Lenient',
      { allowUnimplemented: true },
    );

    expect(result.success).toBe(true);
    expect(result.indicatorFactory).toBeDefined();
    const body = (result.indicatorFactory as { __pineJsBody?: string })
      ?.__pineJsBody;
    expect(typeof body).toBe('string');
    expect(body).toContain('ta.foo(');
  });

  it('keeps existing behavior for mapped std calls', () => {
    const result = transpileToPineJS(
      MAPPED_TA_SCRIPT,
      'unimplemented_mapped',
      'Unimplemented Mapped',
    );
    expect(result.success).toBe(true);
  });
});

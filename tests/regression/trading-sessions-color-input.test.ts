import { describe, expect, it } from 'bun:test';
import { transpileToPineJS } from '../../src/index';

const SESSION_COLOR_SOURCE = `//@version=6
indicator("Trading Sessions", overlay = true)
const string FIRST_SESSION_GROUP = "First Session"
firstSessionColor = input.color(color.new(#2962FF, 85), "Session color", group = FIRST_SESSION_GROUP)
`;

describe('Trading Sessions color input metadata', () => {
  it('emits a color input with a color default for color.new(...)', () => {
    const result = transpileToPineJS(
      SESSION_COLOR_SOURCE,
      'trading_sessions_color_input',
      'Trading Sessions Color Input',
    );
    if (!result.success || !result.indicatorFactory) {
      throw new Error(result.error ?? 'transpile failed');
    }

    const indicator = result.indicatorFactory({ Std: {} } as never);

    expect(indicator.metainfo.inputs).toEqual([
      expect.objectContaining({
        id: 'in_0',
        name: 'Session color',
        type: 'color',
        defval: '#2962FF26',
      }),
    ]);
    expect(indicator.metainfo.defaults.inputs).toEqual({
      in_0: '#2962FF26',
    });
  });
});

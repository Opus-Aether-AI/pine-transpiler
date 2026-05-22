import { describe, expect, it } from 'bun:test';
import {
  runRuntimePath,
  runStandalonePath,
} from './standalone-parity-test-utils';

const STR_FORMAT_TIME_SCRIPT = `//@version=6
indicator("StrFormatTime Support", overlay=false)
formatted = str.format_time(time, "HH:mm dd-MM-yyyy", syminfo.timezone)
plot(str.length(formatted))
`;

const LOG_NAMESPACE_SCRIPT = `//@version=6
indicator("Log Namespace Support", overlay=false)
log.info("bar", bar_index, close)
plot(close)
`;

describe('log/str namespace support', () => {
  it('supports str.format_time in standalone and runtime paths', () => {
    const fixtureId = 'str-format-time-support';
    const bars = 40;
    const runtimeTrace = runRuntimePath(STR_FORMAT_TIME_SCRIPT, fixtureId, bars);
    const standaloneTrace = runStandalonePath(
      STR_FORMAT_TIME_SCRIPT,
      fixtureId,
      bars,
    );

    expect(runtimeTrace.errors).toEqual([]);
    expect(standaloneTrace.errors).toEqual([]);
    expect(standaloneTrace.plotsByBar).toEqual(runtimeTrace.plotsByBar);
  });

  it('supports log namespace without runtime errors', () => {
    const fixtureId = 'log-namespace-support';
    const bars = 20;
    const runtimeTrace = runRuntimePath(LOG_NAMESPACE_SCRIPT, fixtureId, bars);
    const standaloneTrace = runStandalonePath(LOG_NAMESPACE_SCRIPT, fixtureId, bars);

    expect(runtimeTrace.errors).toEqual([]);
    expect(standaloneTrace.errors).toEqual([]);
    expect(standaloneTrace.plotsByBar).toEqual(runtimeTrace.plotsByBar);
  });
});

/**
 * Info Command
 *
 * Handles the 'info' CLI command for showing supported features and stats.
 */

import { getMappingStats } from '../../index.js';
import { getVersion } from '../utils';

/**
 * Execute the info command
 */
export function commandInfo(): void {
  const stats = getMappingStats();
  const VERSION = getVersion();

  console.log(`
Pine Script Transpiler v${VERSION}
================================

Supported Function Mappings:
  Technical Analysis (ta.*):  ${stats.ta} functions
  Math (math.*):              ${stats.math} functions
  Time Functions:             ${stats.time} functions
  Multi-Output Functions:     ${stats.multiOutput} functions
  Total Mapped Functions:     ${stats.total} functions

Supported Features:
  • Variable declarations (var, varip)
  • Function declarations
  • Control flow (if/else, for, while, switch)
  • Technical indicators (SMA, EMA, RSI, MACD, etc.)
  • Input parameters
  • Plot functions
  • Type annotations
  • Arrays and tuples

Limitations:
  • No request.security() support
  • Limited drawing functions (box, line, label)
  • No table support
  • Some advanced Pine Script v5 features

For more information, visit:
  https://github.com/Opus-Aether-AI/pine-transpiler
`);
}

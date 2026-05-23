#!/usr/bin/env node
/**
 * Pine Script Transpiler CLI
 *
 * Command-line interface for transpiling Pine Script to JavaScript/PineJS format.
 */

import {
  commandCheck,
  commandInfo,
  commandTranspile,
  commandValidate,
} from './commands';
import { getHelpText, getVersion, parseArguments } from './utils';

/**
 * Main CLI entry point
 */
function main(): void {
  const { command, file, options } = parseArguments();

  if (options.version) {
    process.stdout.write(`pine-transpiler v${getVersion()}\n`);
    process.exit(0);
  }

  if (options.help || !command) {
    process.stdout.write(getHelpText());
    process.exit(0);
  }

  switch (command) {
    case 'transpile':
      commandTranspile(file, options);
      break;
    case 'validate':
      commandValidate(file, options);
      break;
    case 'check':
      commandCheck(file, options);
      break;
    case 'info':
      commandInfo();
      break;
    default:
      process.stderr.write(`Error: Unknown command '${command}'\n`);
      process.stdout.write(getHelpText());
      process.exit(1);
  }
}

main();

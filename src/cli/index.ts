#!/usr/bin/env node
/**
 * Pine Script Transpiler CLI
 *
 * Command-line interface for transpiling Pine Script to JavaScript/PineJS format.
 */

import { commandInfo, commandTranspile, commandValidate } from './commands';
import { getHelpText, getVersion, parseArguments } from './utils';

/**
 * Main CLI entry point
 */
function main(): void {
  const { command, file, options } = parseArguments();

  if (options.version) {
    console.log(`pine-transpiler v${getVersion()}`);
    process.exit(0);
  }

  if (options.help || !command) {
    console.log(getHelpText());
    process.exit(0);
  }

  switch (command) {
    case 'transpile':
      commandTranspile(file, options);
      break;
    case 'validate':
      commandValidate(file, options);
      break;
    case 'info':
      commandInfo();
      break;
    default:
      console.error(`Error: Unknown command '${command}'`);
      console.log(getHelpText());
      process.exit(1);
  }
}

main();

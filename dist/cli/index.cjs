#!/usr/bin/env node
const require_src = require("../src-C14HYoXL.cjs");
let node_fs = require("node:fs");
let node_path = require("node:path");
let node_url = require("node:url");
let node_util = require("node:util");
//#region src/cli/utils.ts
/**
* CLI Utilities
*
* Shared utility functions for CLI commands.
*/
var cachedVersion = null;
/**
* Read version from package.json
*/
function getVersion() {
	if (cachedVersion) return cachedVersion;
	const packageJsonPath = (0, node_path.join)((0, node_path.dirname)((0, node_url.fileURLToPath)({}.url)), "..", "..", "package.json");
	let version = "0.1.3";
	try {
		version = JSON.parse((0, node_fs.readFileSync)(packageJsonPath, "utf-8")).version || version;
	} catch {}
	cachedVersion = version;
	return version;
}
/**
* Generate help text
*/
function getHelpText() {
	return `
Pine Script Transpiler v${getVersion()}

USAGE:
  pine-transpiler <command> [options] [file]

COMMANDS:
  transpile <file>   Transpile a Pine Script file to JavaScript
  validate <file>    Validate Pine Script syntax without transpiling
  info               Show supported features and mapping statistics

OPTIONS:
  -o, --output <file>   Output file path (default: stdout)
  -f, --format <type>   Output format: 'js' or 'pinejs' (default: js)
  -n, --name <name>     Indicator name (for pinejs format)
  -i, --id <id>         Indicator ID (for pinejs format, default: derived from filename)
  -h, --help            Show this help message
  -v, --version         Show version number

EXAMPLES:
  # Transpile to JavaScript (stdout)
  pine-transpiler transpile script.pine

  # Transpile to file
  pine-transpiler transpile script.pine -o output.js

  # Transpile to PineJS factory format
  pine-transpiler transpile script.pine -f pinejs -o indicator.js

  # Validate syntax
  pine-transpiler validate script.pine

  # Show supported features
  pine-transpiler info
`;
}
/**
* Parse command-line arguments
*/
function parseArguments() {
	const { values, positionals } = (0, node_util.parseArgs)({
		options: {
			output: {
				type: "string",
				short: "o"
			},
			format: {
				type: "string",
				short: "f",
				default: "js"
			},
			name: {
				type: "string",
				short: "n"
			},
			id: {
				type: "string",
				short: "i"
			},
			help: {
				type: "boolean",
				short: "h",
				default: false
			},
			version: {
				type: "boolean",
				short: "v",
				default: false
			}
		},
		allowPositionals: true,
		strict: false
	});
	const [command, file] = positionals;
	return {
		command: command || "",
		file,
		options: values
	};
}
/**
* Read input file content
*/
function readInput(filePath) {
	const resolvedPath = (0, node_path.resolve)(filePath);
	if (!(0, node_fs.existsSync)(resolvedPath)) {
		console.error(`Error: File not found: ${filePath}`);
		process.exit(1);
	}
	return (0, node_fs.readFileSync)(resolvedPath, "utf-8");
}
/**
* Write output to file or stdout
*/
function writeOutput(content, outputPath) {
	if (outputPath) {
		(0, node_fs.writeFileSync)((0, node_path.resolve)(outputPath), content, "utf-8");
		console.error(`Written to: ${outputPath}`);
	} else console.log(content);
}
/**
* Derive indicator ID from file path
*/
function deriveIndicatorId(filePath) {
	return (0, node_path.basename)(filePath, ".pine").replace(/[^a-zA-Z0-9_]/g, "_");
}
//#endregion
//#region src/cli/commands/info.ts
/**
* Info Command
*
* Handles the 'info' CLI command for showing supported features and stats.
*/
/**
* Execute the info command
*/
function commandInfo() {
	const stats = require_src.getMappingStats();
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
  • Partial request.security() passthrough (no true MTF aggregation)
  • Drawing/table are runtime-compatible no-op objects (no visual rendering)
  • Some advanced Pine Script v5 features

For more information, visit:
  https://github.com/Opus-Aether-AI/pine-transpiler
`);
}
//#endregion
//#region src/cli/commands/transpile.ts
/**
* Transpile Command
*
* Handles the 'transpile' CLI command for converting Pine Script to JavaScript.
*/
/**
* Generate PineJS factory code for module export
*/
function generatePineJSFactoryCode(pineCode, indicatorId, indicatorName) {
	const escapedCode = JSON.stringify(pineCode);
	const nameStr = indicatorName ? JSON.stringify(indicatorName) : "undefined";
	return `/**
 * PineJS Indicator Factory
 * Generated by pine-transpiler
 *
 * Usage:
 *   import { createIndicator } from './output.js';
 *   const indicator = createIndicator(PineJS);
 */

import { transpileToPineJS } from '@opusaether/pine-transpiler';

const pineCode = ${escapedCode};
const indicatorId = ${JSON.stringify(indicatorId)};
const indicatorName = ${nameStr};

export function createIndicator(PineJS) {
  const result = transpileToPineJS(pineCode, indicatorId, indicatorName);
  if (!result.success) {
    throw new Error('Transpilation failed: ' + result.error);
  }
  return result.indicatorFactory(PineJS);
}

export default createIndicator;
`;
}
/**
* Execute the transpile command
*/
function commandTranspile(file, options) {
	if (!file) {
		console.error("Error: No input file specified");
		console.error("Usage: pine-transpiler transpile <file>");
		process.exit(1);
	}
	const code = readInput(file);
	const format = options.format || "js";
	if (format === "js") try {
		writeOutput(require_src.transpile(code), options.output);
	} catch (error) {
		console.error("Transpilation error:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
	else if (format === "pinejs") {
		const indicatorId = options.id || deriveIndicatorId(file);
		const indicatorName = options.name;
		const result = require_src.transpileToPineJS(code, indicatorId, indicatorName);
		if (!result.success) {
			console.error("Transpilation error:", result.error);
			process.exit(1);
		}
		writeOutput(generatePineJSFactoryCode(code, indicatorId, indicatorName), options.output);
	} else if (format === "factory") {
		const indicatorId = options.id || deriveIndicatorId(file);
		const indicatorName = options.name;
		try {
			const ast = new require_src.Parser(new require_src.Lexer(code).tokenize()).parse();
			const visitor = new require_src.MetadataVisitor();
			visitor.visit(ast);
			const mainBody = new require_src.ASTGenerator(visitor.historicalAccess).generate(ast);
			writeOutput(require_src.generateStandaloneFactory({
				indicatorId,
				indicatorName,
				name: visitor.name,
				shortName: visitor.shortName,
				overlay: visitor.overlay,
				plots: visitor.plots,
				inputs: visitor.inputs,
				bgcolors: visitor.bgcolors,
				usedSources: visitor.usedSources,
				historicalAccess: visitor.historicalAccess,
				mainBody,
				sessionVariables: visitor.sessionVariables,
				derivedSessionVariables: visitor.derivedSessionVariables,
				booleanInputMap: visitor.booleanInputMap,
				computedVariables: visitor.computedVariables,
				inputVariableMap: visitor.inputVariableMap
			}), options.output);
		} catch (error) {
			console.error("Transpilation error:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	} else {
		console.error(`Error: Unknown format '${format}'. Use 'js', 'pinejs', or 'factory'.`);
		process.exit(1);
	}
}
//#endregion
//#region src/cli/commands/validate.ts
/**
* Validate Command
*
* Handles the 'validate' CLI command for checking Pine Script syntax.
*/
/**
* Execute the validate command
*/
function commandValidate(file, _options) {
	if (!file) {
		console.error("Error: No input file specified");
		console.error("Usage: pine-transpiler validate <file>");
		process.exit(1);
	}
	const result = require_src.canTranspilePineScript(readInput(file));
	if (result.valid) {
		console.log(`✓ ${file} is valid Pine Script`);
		process.exit(0);
	} else {
		console.error(`✗ ${file} has syntax errors:`);
		console.error(`  ${result.reason}`);
		process.exit(1);
	}
}
//#endregion
//#region src/cli/index.ts
/**
* Pine Script Transpiler CLI
*
* Command-line interface for transpiling Pine Script to JavaScript/PineJS format.
*/
/**
* Main CLI entry point
*/
function main() {
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
		case "transpile":
			commandTranspile(file, options);
			break;
		case "validate":
			commandValidate(file, options);
			break;
		case "info":
			commandInfo();
			break;
		default:
			console.error(`Error: Unknown command '${command}'`);
			console.log(getHelpText());
			process.exit(1);
	}
}
main();
//#endregion

//# sourceMappingURL=index.cjs.map
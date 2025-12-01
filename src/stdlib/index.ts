/**
 * StdPlus Polyfill Library
 *
 * This file re-exports the StdPlus library from the runtime helpers module.
 * StdPlus provides implementations for Pine Script functions that are
 * missing from the native PineJS.Std library.
 *
 * This string is injected into the transpiled script preamble.
 */

export { STD_PLUS_LIBRARY } from '../runtime/helpers';

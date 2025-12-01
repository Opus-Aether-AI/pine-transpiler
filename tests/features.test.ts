import { describe, expect, it } from 'vitest';
import { transpile } from '../src/index';

describe('New Features', () => {
  it('should transpile export variable', () => {
    const pine = 'export var x = 1';
    const js = transpile(pine);
    expect(js).toContain('export let x = 1;');
  });

  it('should transpile export function', () => {
    const pine = 'export f(x) => x + 1';
    const js = transpile(pine);
    expect(js).toContain('export function f(x) {');
  });

  it('should transpile export type', () => {
    const pine = `
export type Point
    float x
    float y
`;
    const js = transpile(pine);
    expect(js).toContain('export class Point');
  });

  it('should transpile method declaration', () => {
    const pine = 'method m(int x) => x * 2';
    const js = transpile(pine);
    expect(js).toContain('function m(x)'); // Methods are just functions in JS for now
  });

  it('should transpile import statement', () => {
    const pine = 'import "user/lib/1" as Lib';
    const js = transpile(pine);
    expect(js).toContain('import * as Lib from "user/lib/1";');
  });

  it('should transpile generic types', () => {
    const pine = 'var array<int> a = array.new<int>(10)';
    const js = transpile(pine);
    expect(js).toContain('let a ='); // Types are stripped or handled, mainly parser check
  });

  it('should transpile ta.hma correctly', () => {
    const pine = 'plot(ta.hma(close, 14))';
    const js = transpile(pine);
    expect(js).toContain('StdPlus.hma(context, close, 14)');
  });
});

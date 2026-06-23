#!/usr/bin/env bun
import { relative } from 'node:path';
import {
  SUPPORTED_SURFACE_DOC_PATH,
  writeSupportedSurfaceDoc,
} from '../src/registry/supported-surface';

const { changed } = writeSupportedSurfaceDoc();
const relativePath = relative(process.cwd(), SUPPORTED_SURFACE_DOC_PATH);

console.log(`${changed ? 'wrote' : 'unchanged'} ${relativePath}`);

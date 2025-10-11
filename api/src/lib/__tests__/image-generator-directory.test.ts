/**
 * IMAGE GENERATOR DIRECTORY CREATION TEST
 * Target: Cover lines 15-16 (directory creation)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Image Generator - Directory Creation', () => {
  const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
  let dirExistedBefore = false;

  beforeAll(() => {
    // Check if directory exists
    dirExistedBefore = fs.existsSync(IMAGES_DIR);

    // Delete directory to force creation
    if (dirExistedBefore) {
      fs.rmSync(IMAGES_DIR, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    // Restore directory if it existed before
    if (dirExistedBefore && !fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
  });

  it('should create images directory if it does not exist (lines 15-16)', async () => {
    // Verify directory was deleted
    expect(fs.existsSync(IMAGES_DIR)).toBe(false);

    // Import module - this triggers lines 14-16
    const imageGenerator = await import('../image-generator.js');

    // Verify directory was created
    expect(fs.existsSync(IMAGES_DIR)).toBe(true);

    // Verify it's actually a directory
    const stats = fs.statSync(IMAGES_DIR);
    expect(stats.isDirectory()).toBe(true);

    console.log('✓ Image directory creation (lines 15-16) covered');
  });
});

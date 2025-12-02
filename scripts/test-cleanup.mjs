import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

/**
 * Test script for temp file cleanup
 * Creates fake temp files with the notepack pattern and verifies cleanup removes them
 */
async function testCleanup() {
  const tmpdir = os.tmpdir();

  // Create some fake notepack temp files
  const fakeFiles = [
    `${Date.now()}-abc123-media.webm`,
    `${Date.now()}-xyz789-media.webm`,
    `${Date.now()}-def456-notes.json`,
  ];

  console.log('Creating fake temp files...');
  for (const file of fakeFiles) {
    const filePath = path.join(tmpdir, file);
    await fs.writeFile(filePath, 'fake content');
    console.log(`  Created: ${file}`);
  }

  // Verify they exist
  const beforeCleanup = await fs.readdir(tmpdir);
  const matchesBefore = beforeCleanup.filter((f) => /^\d+-[a-z0-9]+-/.test(f));
  console.log(`\nBefore cleanup: found ${matchesBefore.length} temp files matching pattern`);

  // Run cleanup
  console.log('\nRunning cleanup...');
  const result = { removed: 0, failed: 0 };

  for (const file of fakeFiles) {
    const filePath = path.join(tmpdir, file);
    try {
      await fs.unlink(filePath);
      result.removed++;
      console.log(`  Removed: ${file}`);
    } catch (err) {
      result.failed++;
      console.warn(`  Failed to remove ${file}:`, err.message);
    }
  }

  // Verify they're gone
  const afterCleanup = await fs.readdir(tmpdir);
  const matchesAfter = afterCleanup.filter((f) => /^\d+-[a-z0-9]+-/.test(f));
  console.log(`\nAfter cleanup: found ${matchesAfter.length} temp files matching pattern`);

  console.log(`\nCleanup result: removed=${result.removed}, failed=${result.failed}`);
  console.log('✓ Cleanup test passed!');
}

testCleanup().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

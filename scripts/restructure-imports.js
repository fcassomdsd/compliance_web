#!/usr/bin/env node

/**
 * Script to update all imports to use @ path alias after restructuring
 * Usage: node scripts/restructure-imports.js
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Mapping of old paths to new paths with @ alias
// Order matters - more specific patterns first!
const pathMappings = [
  // Local same-directory imports to services
  { old: /from\s+['"]\.\/apiServices\.js['"]/g, new: "from '@/services/apiServices'" },
  { old: /from\s+['"]\.\/apiServices['"]/g, new: "from '@/services/apiServices'" },
  
  // Services
  { old: /from\s+['"]\.\.\/services\/apiServices['"]/g, new: "from '@/services/apiServices'" },
  { old: /from\s+['"]\.\.\/\.\.\/services\/apiServices['"]/g, new: "from '@/services/apiServices'" },
  { old: /from\s+['"]\.\/\.\/apiServices['"]/g, new: "from '@/services/apiServices'" },
  
  // Stores (must come before components due to similar patterns)
  { old: /from\s+['"]\.\.\/stores\//g, new: "from '@/stores/" },
  { old: /from\s+['"]\.\.\/\.\.\/stores\//g, new: "from '@/stores/" },
  { old: /import\s+.*\s+from\s+['"]\.\.\/stores\//g, new: (match) => match.replace(/\.\.\/stores\//g, '@/stores/') },
  
  // Views
  { old: /from\s+['"]\.\.\/views\//g, new: "from '@/views/" },
  { old: /from\s+['"]\.\.\/\.\.\/views\//g, new: "from '@/views/" },
  { old: /from\s+['"]\.\/views\//g, new: "from '@/views/" },
  
  // Components
  { old: /from\s+['"]\.\.\/components\//g, new: "from '@/components/" },
  { old: /from\s+['"]\.\.\/\.\.\/components\//g, new: "from '@/components/" },
  { old: /from\s+['"]\.\/components\//g, new: "from '@/components/" },
  
  // Images (common in views)
  { old: /from\s+['"]\.\.\/images\//g, new: "from '@/images/" },
  { old: /from\s+['"]\.\/\.\.\/images\//g, new: "from '@/images/" },
  
  // Utils
  { old: /from\s+['"]\.\.\/utils\/['"]/g, new: "from '@/utils/" },
  { old: /from\s+['"]\.\.\/\.\.\/utils\/['"]/g, new: "from '@/utils/" },
  { old: /from\s+['"]\.\.\/utils['"]/g, new: "from '@/utils/helpers'" },
  { old: /from\s+['"]\.\.\/\.\.\/utils['"]/g, new: "from '@/utils/helpers'" },
  { old: /from\s+['"]\.\/\.\.\/utils\//g, new: "from '@/utils/" },
  
  // Composables
  { old: /from\s+['"]\.\.\/composables\//g, new: "from '@/composables/" },
  { old: /from\s+['"]\.\.\/\.\.\/composables\//g, new: "from '@/composables/" },
  
  // Router
  { old: /from\s+['"]\.\.\/router\//g, new: "from '@/router/" },
  { old: /from\s+['"]\.\.\/\.\.\/router\//g, new: "from '@/router/" },
  
  // i18n
  { old: /from\s+['"]\.\.\/i18n\//g, new: "from '@/i18n/" },
  { old: /from\s+['"]\.\.\/\.\.\/i18n\//g, new: "from '@/i18n/" },
];

// Special mappings for test files that import from src
const testPathMappings = [
  // Test files referencing ../src/ (old test location)
  { old: /from\s+['"]\.\.\/src\/apiServices\.js['"]/g, new: "from '@/services/apiServices'" },
  { old: /from\s+['"]\.\.\/src\/apiServices['"]/g, new: "from '@/services/apiServices'" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/services\/apiServices['"]/g, new: "from '@/services/apiServices'" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/stores\//g, new: "from '@/stores/" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/components\//g, new: "from '@/components/" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/views\//g, new: "from '@/views/" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/utils\//g, new: "from '@/utils/" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/composables\//g, new: "from '@/composables/" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/router\//g, new: "from '@/router/" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/i18n\//g, new: "from '@/i18n/" },
  { old: /from\s+['"]\.\.\/src\/stores\//g, new: "from '@/stores/" },
  { old: /from\s+['"]\.\.\/src\/components\//g, new: "from '@/components/" },
  { old: /from\s+['"]\.\.\/src\/views\//g, new: "from '@/views/" },
  { old: /from\s+['"]\.\.\/src\/composables\//g, new: "from '@/composables/" },
  { old: /from\s+['"]\.\.\/src\/router\//g, new: "from '@/router/" },
  { old: /from\s+['"]\.\.\/src\/i18n\//g, new: "from '@/i18n/" },
  
  // Direct apiServices imports in tests
  { old: /from\s+['"]\.\.\/src\/utils\.js['"]/g, new: "from '@/utils/helpers'" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/utils\.js['"]/g, new: "from '@/utils/helpers'" },
  { old: /from\s+['"]\.\.\/src\/App\.vue['"]/g, new: "from '@/App.vue'" },
  { old: /from\s+['"]\.\.\/\.\.\/src\/App\.vue['"]/g, new: "from '@/App.vue'" },
];

/**
 * Get all files to process
 */
function getAllFiles(dir, ext = ['.js', '.vue']) {
  let files = [];
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and coverage
      if (['.git', 'node_modules', 'build', 'dist', 'coverage'].includes(item)) {
        continue;
      }
      files = files.concat(getAllFiles(fullPath, ext));
    } else if (ext.includes(path.extname(item))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Update imports in a file
 */
function updateImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Determine if this is a test file
  const isTestFile = filePath.includes('/tests/') || filePath.endsWith('.test.js');
  const mappings = isTestFile ? [...pathMappings, ...testPathMappings] : pathMappings;
  
  // Apply all mappings
  for (const mapping of mappings) {
    content = content.replace(mapping.old, mapping.new);
  }
  
  // Additional handling for vi.mock() paths - convert to use new locations
  content = content.replace(/vi\.mock\(['"]\.\.\/src\/apiServices['"]/g, "vi.mock('@/services/apiServices'");
  content = content.replace(/vi\.mock\(['"]\.\.\/\.\.\/src\/apiServices['"]/g, "vi.mock('@/services/apiServices'");
  content = content.replace(/vi\.mock\(['"]\.\.\/src\/services\/['"]/g, "vi.mock('@/services/");
  content = content.replace(/vi\.mock\(['"]\.\.\/src\/stores\/['"]/g, "vi.mock('@/stores/");
  content = content.replace(/vi\.mock\(['"]\.\.\/src\/components\/['"]/g, "vi.mock('@/components/");
  content = content.replace(/vi\.mock\(['"]\.\.\/src\/views\/['"]/g, "vi.mock('@/views/");
}

/**
 * Main function
 */
function main() {
  log('\n=== Starting import restructuring ===\n', 'blue');
  
  const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
  const rootDir = path.resolve(scriptDir, '..');
  const files = getAllFiles(rootDir);
  
  log(`Found ${files.length} files to process\n`, 'yellow');
  
  let updated = 0;
  const failedFiles = [];
  
  for (const file of files) {
    const relativePath = path.relative(rootDir, file);
    
    try {
      if (updateImportsInFile(file)) {
        updated++;
        log(`✓ ${relativePath}`, 'green');
      }
    } catch (error) {
      failedFiles.push({ file: relativePath, error: error.message });
      log(`✗ ${relativePath}: ${error.message}`, 'red');
    }
  }
  
  log(`\n=== Results ===\n`, 'blue');
  log(`Files updated: ${updated}/${files.length}`, 'green');
  
  if (failedFiles.length > 0) {
    log(`\nFailed files:`, 'red');
    failedFiles.forEach(({ file, error }) => {
      log(`  - ${file}: ${error}`, 'red');
    });
  }
  
  log(`\n✓ Import restructuring complete!\n`, 'green');
}

// Run the script
main();

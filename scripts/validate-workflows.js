#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const workflowsDir = path.resolve(__dirname, '..', '.github', 'workflows');
const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
let failed = false;
for (const f of files) {
  const p = path.join(workflowsDir, f);
  try {
    const content = fs.readFileSync(p, 'utf8');
    yaml.load(content);
    console.log('OK', f);
  } catch (e) {
    console.error('ERROR parsing', f, e && e.message ? e.message : e);
    failed = true;
  }
}
if (failed) process.exit(2);
console.log('All workflow YAML files parsed successfully');

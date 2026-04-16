#!/usr/bin/env node
const { main } = require('../dist/cli');
main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[path-alias] fatal:', err);
    process.exit(1);
  });

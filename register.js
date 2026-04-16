// Side-effect entry: `require('path-alias-plugin/register')`.
// This file lives at the package root (not under dist/) so the subpath import
// resolves before the package's own `exports` map is parsed strictly.
module.exports = require('./dist/runtime/register');

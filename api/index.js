'use strict';
/* Vercel entry point: every path is rewritten here (vercel.json). The handler is the same one `node server.js` serves locally. */
module.exports = require('../server.js').handler;

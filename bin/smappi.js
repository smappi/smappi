#!/usr/bin/env node

/* eslint no-console: 0 */

var yargs = require('yargs');
var commands = require('../lib/commands');

var argv = yargs
  .strict()
  .command(commands.run)
  .fail(function(msg, error) {
    if (error) {
      throw error;
    } else {
      yargs.showHelp('error');
      console.error(msg);
      return yargs.exit(1);
    }
  })
  .example('smappi run')
  .version()
  .usage(
    `Usage:

  # Run api.js as Simple Http Server
  $0 run localhost:8000

  # Run doctests
  npm test`
  )
  .recommendCommands()
  .help().argv;

if (!argv._handled) {
  yargs.showHelp('error');
  process.exit(1);
}

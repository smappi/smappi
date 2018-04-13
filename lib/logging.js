const log4js = require('log4js');

log4js.configure({
    appenders: {
        logstash: {
            type: 'logstashHTTP',
            url: 'http://' + (process.env.LOG_HOST || 'localhost') + ':9200/_bulk',
            application: 'logstash-log4js',
            logType: 'application',
            logChannel: process.env.LOG_CHANNEL || 'unknown'
        },
        console: {
            type: 'console'
        }
    },
    categories: {
        default: {
            appenders: ['console'],
            level: 'debug'
        },
        production: {
            appenders: ['logstash'],
            level: 'info'
        }
    }
});

const logger = log4js.getLogger(process.env.ENVIRON);
logger.log = logger.info;

module.exports = { logger }

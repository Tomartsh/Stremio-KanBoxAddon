const log4js = require("log4js");
const { LOG4JS } = require("./constants");

const isVercel = !!process.env.VERCEL;

if (isVercel) {
	log4js.configure({
		appenders: {
			out: {
				type: "stdout",
				layout: { type: "coloured" }
			}
		},
		categories: { default: { appenders: ['out'], level: LOG4JS.LEVEL } }
	});
} else {
	log4js.configure({
		appenders: {
			console: {
				type: "stdout",
				layout: {
					type: "coloured",
					pattern: "%[%d{ISO8601}|%p|%c%] %m"
				}
			},
			Stremio: {
				type: LOG4JS.TYPE,
				filename: LOG4JS.FILENAME,
				maxLogSize: LOG4JS.MAX_SIZE,
				backups: LOG4JS.BACKUP_FILES
			}
		},
		categories: { default: { appenders: ['Stremio', 'console'], level: LOG4JS.LEVEL } }
	});
}

module.exports = log4js;

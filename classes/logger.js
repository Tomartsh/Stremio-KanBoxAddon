const log4js = require("log4js");
const { LOG4JS } = require("./constants");

const isVercel = !!process.env.VERCEL;

if (isVercel) {
	log4js.configure({
		appenders: {
			out: { type: "stdout" }
		},
		categories: { default: { appenders: ['out'], level: LOG4JS.LEVEL } }
	});
} else {
	log4js.configure({
		appenders: {
			out: { type: "stdout" },
			Stremio: {
				type: LOG4JS.TYPE,
				filename: LOG4JS.FILENAME,
				maxLogSize: LOG4JS.MAX_SIZE,
				backups: LOG4JS.BACKUP_FILES
			}
		},
		categories: { default: { appenders: ['Stremio', 'out'], level: LOG4JS.LEVEL } }
	});
}

module.exports = log4js;

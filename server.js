#!/usr/bin/env node

const log4js = require("./classes/logger");
const app = require("./app");

const PORT = process.env.PORT || 49621;
const logger = log4js.getLogger("server");

app.listen(PORT, () => {
	logger.info('HTTP addon accessible at: http://127.0.0.1:' + PORT + '/manifest.json');
});

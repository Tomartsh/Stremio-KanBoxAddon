#!/usr/bin/env node

const log4js = require("./classes/logger");
const app = require("./app");

const PORT = process.env.PORT || 49621;
const logger = log4js.getLogger("server");

// Add error handlers to catch exit causes
process.on('uncaughtException', (err) => {
	logger.error('UNCAUGHT EXCEPTION:', err);
	logger.error('Stack:', err.stack);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('UNHANDLED REJECTION:', reason);
	logger.error('Promise:', promise);
	process.exit(1);
});

const server = app.listen(PORT, () => {
	logger.info('HTTP addon accessible at: http://127.0.0.1:' + PORT + '/manifest.json');
	logger.info('Server PID:', process.pid);
});

// Keep the process alive (Node.js v22+ compatibility)
// Prevents exit when initial async operations complete
const keepAlive = setInterval(() => {
	// This interval keeps the event loop alive
}, 60000); // Every minute

logger.info('Server started - keep-alive interval active');

// Cleanup on exit
process.on('SIGINT', () => {
	logger.info('SIGINT received, shutting down gracefully...');
	clearInterval(keepAlive);
	server.close(() => {
		logger.info('Server closed');
		process.exit(0);
	});
});

process.on('SIGTERM', () => {
	logger.info('SIGTERM received, shutting down gracefully...');
	clearInterval(keepAlive);
	server.close(() => {
		logger.info('Server closed');
		process.exit(0);
	});
});

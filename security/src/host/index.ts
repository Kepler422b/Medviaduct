import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { safeLog } from '../security/middleware/redact.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const { app } = createApp();

const server = app.listen(port, () => {
  safeLog(`[SECURITY_HOST_STARTED] Medviaduct Security Module listening on port ${port}`);
  safeLog(`[SECURITY_MODE] Fail-closed authentication active pending Member 2 integration`);
});

const gracefulShutdown = () => {
  safeLog('[SECURITY_HOST_SHUTDOWN] Terminating gracefully...');
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

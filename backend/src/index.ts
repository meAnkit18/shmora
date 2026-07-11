import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { coursesRouter } from './routes/courses.js';
import { registerGateway, type TeacherServer } from './socket/gateway.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../shared/types.js';

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(healthRouter);
app.use(coursesRouter);

const httpServer = createServer(app);
const io: TeacherServer = new Server<ClientToServerEvents, ServerToClientEvents>(
  httpServer,
  { cors: { origin: config.clientOrigin } },
);

registerGateway(io);

httpServer.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
  console.log(`[server] AI model: ${config.ai.model}`);
});

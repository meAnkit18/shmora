import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../shared/types.js';
import { registerSessionHandlers } from '../controllers/sessionController.js';

export type TeacherServer = Server<ClientToServerEvents, ServerToClientEvents>;
export type TeacherSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Transport layer only: registers connection lifecycle and delegates business
// events to the session controller.
export function registerGateway(io: TeacherServer): void {
  io.on('connection', (socket: TeacherSocket) => {
    console.log(`[socket] connected: ${socket.id}`);
    registerSessionHandlers(socket);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });
}

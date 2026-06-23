import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@shared/types';

export type TeacherClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export function createSocket(): TeacherClient {
  return io(URL, { transports: ['websocket'] });
}

import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { config } from '../config.js';

const app: App =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    }),
  });

export const adminAuth = getAuth(app);

export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  return adminAuth.verifyIdToken(token);
}

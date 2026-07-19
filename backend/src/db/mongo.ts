import mongoose from 'mongoose';
import { config } from '../config.js';

export async function connectMongo(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongo.uri);
  console.log('[mongo] connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

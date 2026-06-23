import mongoose from 'mongoose';
import env from './env.js';

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. Retries are left to the caller / process manager.
 */
export async function connectDB(uri = env.MONGODB_URI) {
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  // eslint-disable-next-line no-console
  console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export default mongoose;

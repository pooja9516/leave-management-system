import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Tests run against an in-memory MongoDB (single-node replica set so
// transactions work), never the real database.
let replSet;

export const connectTestDB = async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
};

export const clearTestDB = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

export const closeTestDB = async () => {
  await mongoose.disconnect();
  await replSet?.stop();
};

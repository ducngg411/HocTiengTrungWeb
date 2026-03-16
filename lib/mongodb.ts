import mongoose from "mongoose";

type MongooseCache = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
    mongooseCache?: MongooseCache;
};

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
}

const cached = globalWithMongoose.mongooseCache ?? {
    conn: null,
    promise: null,
};

globalWithMongoose.mongooseCache = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
    const mongoUri = MONGODB_URI;

    if (!mongoUri) {
        throw new Error("Missing MONGODB_URI environment variable");
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(mongoUri, {
            bufferCommands: false,
        });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    throw new Error("Missing MONGODB_URI environment variable");
}

async function run() {
    await mongoose.connect(mongoUri, {
        bufferCommands: false,
    });

    const db = mongoose.connection.db;

    if (!db) {
        throw new Error("Database connection is not available");
    }

    const [progressResult, reviewLogLegacyHardResult, reviewLogLegacyEasyResult, reviewLogResult] = await Promise.all([
        db.collection("usercardprogresses").updateMany(
            {},
            {
                $unset: {
                    nextReviewAt: "",
                    easeFactor: "",
                    intervalDays: "",
                    lastResult: "",
                },
            }
        ),
        db.collection("reviewlogs").updateMany(
            {
                $or: [{ grade: "hard" }, { action: "reviewed" }],
            },
            {
                $set: {
                    action: "hard",
                },
            }
        ),
        db.collection("reviewlogs").updateMany(
            {
                $or: [{ grade: { $in: ["good", "easy"] } }, { action: "mastered" }],
            },
            {
                $set: {
                    action: "easy",
                },
            }
        ),
        db.collection("reviewlogs").updateMany(
            {},
            {
                $unset: {
                    grade: "",
                    easeFactorAfter: "",
                    intervalDaysAfter: "",
                },
            }
        ),
    ]);

    console.log(`Updated usercardprogresses: matched=${progressResult.matchedCount}, modified=${progressResult.modifiedCount}`);
    console.log(`Mapped legacy hard actions: matched=${reviewLogLegacyHardResult.matchedCount}, modified=${reviewLogLegacyHardResult.modifiedCount}`);
    console.log(`Mapped legacy easy actions: matched=${reviewLogLegacyEasyResult.matchedCount}, modified=${reviewLogLegacyEasyResult.modifiedCount}`);
    console.log(`Updated reviewlogs: matched=${reviewLogResult.matchedCount}, modified=${reviewLogResult.modifiedCount}`);
}

run()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
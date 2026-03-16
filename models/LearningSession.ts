import { model, models, Schema, type InferSchemaType } from "mongoose";

const learningSessionSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        deckId: {
            type: Schema.Types.ObjectId,
            ref: "Deck",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["learn", "review"],
            required: true,
        },
        scope: {
            type: String,
            enum: ["learn", "today", "yesterday", "last-session", "all-learned"],
            required: true,
        },
        plannedCardIds: {
            type: [Schema.Types.ObjectId],
            ref: "Card",
            default: [],
        },
        reviewedCardIds: {
            type: [Schema.Types.ObjectId],
            ref: "Card",
            default: [],
        },
        startedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        endedAt: {
            type: Date,
            default: null,
        },
        stats: {
            hardCount: { type: Number, default: 0, min: 0 },
            easyCount: { type: Number, default: 0, min: 0 },
            totalStudySeconds: { type: Number, default: 0, min: 0 },
        },
    },
    {
        timestamps: true,
    }
);

learningSessionSchema.index({ userId: 1, deckId: 1, type: 1, startedAt: -1 });
learningSessionSchema.index({ userId: 1, deckId: 1, startedAt: -1 });

export type LearningSessionDocument = InferSchemaType<typeof learningSessionSchema>;

const LearningSession = models.LearningSession || model("LearningSession", learningSessionSchema);

export default LearningSession;

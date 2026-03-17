import { model, models, Schema, type InferSchemaType } from "mongoose";

const practiceAttemptSchema = new Schema(
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
        cardId: {
            type: Schema.Types.ObjectId,
            ref: "Card",
            required: true,
            index: true,
        },
        exerciseId: {
            type: Schema.Types.ObjectId,
            ref: "Exercise",
            required: true,
            index: true,
        },
        answer: {
            type: String,
            required: true,
            trim: true,
        },
        aiScore: {
            type: Number,
            required: true,
            min: 0,
            max: 10,
        },
        usageScore: {
            type: Number,
            required: true,
            min: 0,
            max: 10,
        },
        grammarScore: {
            type: Number,
            required: true,
            min: 0,
            max: 10,
        },
        naturalnessScore: {
            type: Number,
            required: true,
            min: 0,
            max: 10,
        },
        correctUsage: {
            type: Boolean,
            default: false,
        },
        aiFeedback: {
            type: String,
            default: "",
            trim: true,
        },
        improvedSentence: {
            type: String,
            default: "",
            trim: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

practiceAttemptSchema.index({ userId: 1, exerciseId: 1, createdAt: -1 });
practiceAttemptSchema.index({ userId: 1, deckId: 1, createdAt: -1 });

export type PracticeAttemptDocument = InferSchemaType<typeof practiceAttemptSchema>;

const PracticeAttempt = models.PracticeAttempt || model("PracticeAttempt", practiceAttemptSchema);

export default PracticeAttempt;

import { model, models, Schema, type InferSchemaType } from "mongoose";

const userCardProgressSchema = new Schema(
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
        reviewCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        lastReviewedAt: {
            type: Date,
            default: null,
        },
        nextReviewAt: {
            type: Date,
            default: null,
        },
        easeFactor: {
            type: Number,
            default: 2.5,
            min: 1.3,
        },
        intervalDays: {
            type: Number,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ["new", "learning", "mastered"],
            default: "new",
        },
        lastResult: {
            type: String,
            enum: ["hard", "good", "easy"],
            default: null,
        },
        totalStudySeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

userCardProgressSchema.index({ userId: 1, cardId: 1 }, { unique: true });
userCardProgressSchema.index({ userId: 1, deckId: 1, status: 1 });
userCardProgressSchema.index({ userId: 1, deckId: 1, nextReviewAt: 1 });

export type UserCardProgressDocument = InferSchemaType<typeof userCardProgressSchema>;

const UserCardProgress = models.UserCardProgress || model("UserCardProgress", userCardProgressSchema);

export default UserCardProgress;

import mongoose, { model, models, Schema, type InferSchemaType } from "mongoose";

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
        status: {
            type: String,
            enum: ["new", "learning", "mastered"],
            default: "new",
        },
        totalStudySeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        firstLearnedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

userCardProgressSchema.index({ userId: 1, cardId: 1 }, { unique: true });
userCardProgressSchema.index({ userId: 1, deckId: 1, status: 1 });

export type UserCardProgressDocument = InferSchemaType<typeof userCardProgressSchema>;

const existingUserCardProgressModel = models.UserCardProgress;

if (
    existingUserCardProgressModel &&
    (
        existingUserCardProgressModel.schema.path("nextReviewAt") ||
        existingUserCardProgressModel.schema.path("easeFactor") ||
        existingUserCardProgressModel.schema.path("intervalDays") ||
        existingUserCardProgressModel.schema.path("lastResult")
    )
) {
    mongoose.deleteModel("UserCardProgress");
}

const UserCardProgress = models.UserCardProgress || model("UserCardProgress", userCardProgressSchema);

export default UserCardProgress;

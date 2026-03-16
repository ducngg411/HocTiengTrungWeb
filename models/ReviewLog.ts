import mongoose, { model, models, Schema, type InferSchemaType } from "mongoose";

const reviewLogSchema = new Schema(
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
        action: {
            type: String,
            enum: ["hard", "easy"],
            required: true,
        },
        studySeconds: {
            type: Number,
            default: 0,
            min: 0,
        },
        reviewedAt: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },
        statusAfter: {
            type: String,
            enum: ["new", "learning", "mastered"],
            required: true,
        },
        sessionId: {
            type: Schema.Types.ObjectId,
            ref: "LearningSession",
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

reviewLogSchema.index({ userId: 1, reviewedAt: -1 });
reviewLogSchema.index({ userId: 1, deckId: 1, reviewedAt: -1 });

export type ReviewLogDocument = InferSchemaType<typeof reviewLogSchema>;

const existingReviewLogModel = models.ReviewLog;

if (
    existingReviewLogModel &&
    (
        existingReviewLogModel.schema.path("grade") ||
        existingReviewLogModel.schema.path("easeFactorAfter") ||
        existingReviewLogModel.schema.path("intervalDaysAfter")
    )
) {
    mongoose.deleteModel("ReviewLog");
}

const ReviewLog = models.ReviewLog || model("ReviewLog", reviewLogSchema);

export default ReviewLog;

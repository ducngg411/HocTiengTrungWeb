import { model, models, Schema, type InferSchemaType } from "mongoose";

const exerciseSchema = new Schema(
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
        type: {
            type: String,
            enum: ["typing", "sentence"],
            required: true,
            index: true,
        },
        mode: {
            type: String,
            enum: ["specific", "random", "translation"],
            required: true,
            index: true,
        },
        instruction: {
            type: String,
            required: true,
            trim: true,
        },
        sourceText: {
            type: String,
            default: "",
            trim: true,
        },
        expectedText: {
            type: String,
            default: "",
            trim: true,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

exerciseSchema.index({ userId: 1, deckId: 1, type: 1, createdAt: -1 });

export type ExerciseDocument = InferSchemaType<typeof exerciseSchema>;

const Exercise = models.Exercise || model("Exercise", exerciseSchema);

export default Exercise;

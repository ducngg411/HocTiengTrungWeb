import { model, models, Schema, type InferSchemaType, Types } from "mongoose";

const deckSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
        spreadsheetId: {
            type: String,
            required: true,
            trim: true,
        },
        sheetName: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

deckSchema.index({ userId: 1, name: 1 });

deckSchema.path("userId").validate((value: Types.ObjectId) => Boolean(value), "Missing userId");

export type DeckDocument = InferSchemaType<typeof deckSchema>;

const Deck = models.Deck || model("Deck", deckSchema);

export default Deck;

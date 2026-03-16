import { model, models, Schema, type InferSchemaType, Types } from "mongoose";

const cardSchema = new Schema(
    {
        deckId: {
            type: Schema.Types.ObjectId,
            ref: "Deck",
            required: true,
            index: true,
        },
        position: {
            type: Number,
            required: true,
            min: 0,
        },
        word: {
            type: String,
            required: true,
            trim: true,
        },
        pinyin: {
            type: String,
            default: "",
            trim: true,
        },
        meaning: {
            type: String,
            default: "",
            trim: true,
        },
        example: {
            type: String,
            default: "",
            trim: true,
        },
        examplePinyin: {
            type: String,
            default: "",
            trim: true,
        },
        exampleMeaning: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

cardSchema.index({ deckId: 1, position: 1 }, { unique: true });
cardSchema.path("deckId").validate((value: Types.ObjectId) => Boolean(value), "Missing deckId");

export type CardDocument = InferSchemaType<typeof cardSchema>;

const Card = models.Card || model("Card", cardSchema);

export default Card;

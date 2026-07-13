const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Product name is required"],
        trim: true
    },
    description: {
        type: String,
        required: [true, "Product description is required"],
        trim: true
    },
    price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"]
    },
    oldPrice: {
        type: Number,
        default: null
    },
    image: {
        type: String,
        required: [true, "Product image is required"]
    },
    badge: {
        type: String,
        default: ""
    },
    colors: {
        type: [String],
        default: []
    },
    colorLabel: {
        type: String,
        default: ""
    },
    rating: {
        type: Number,
        default: 5,
        min: 0,
        max: 5
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    featured: {
        type: Boolean,
        default: false
    },
    stock: {
        type: Number,
        default: 100,
        min: 0
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Product", productSchema);

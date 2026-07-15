// One-off script to populate the database with the original landing-page products.
// Run once with: node seed.js
// Safe to re-run — it clears existing products first.

const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/Product");

dotenv.config();

const products = [
    {
        name: "SOUNDER MODEL 1",
        description: "The original. 36-hour battery, adaptive ANC, studio-tuned sound.",
        price: 249,
        oldPrice: null,
        image: "assets/airpods.png",
        badge: "BEST SELLER",
        colors: ["#F0EDE4", "#8B2020", "#1A3D2B"],
        colorLabel: "PEARL WHITE",
        rating: 4.9,
        reviewCount: 2840,
        featured: false,
        stock: 250,
        sortOrder: 1
    },
    {
        name: "SOUNDER MODEL 1 PRO",
        description: "Spatial audio, bone-conduction mic, lossless Bluetooth 5.4.",
        price: 349,
        oldPrice: 399,
        image: "assets/airpods.png",
        badge: "MOST ADVANCED",
        colors: ["#F0EDE4", "#8B2020"],
        colorLabel: "PEARL WHITE",
        rating: 4.8,
        reviewCount: 1120,
        featured: true,
        stock: 150,
        sortOrder: 2
    },
    {
        name: "SOUNDER MODEL 1 SE",
        description: "24-hour battery, passive noise isolation, premium beryllium drivers.",
        price: 149,
        oldPrice: null,
        image: "assets/airpods.png",
        badge: "ENTRY",
        colors: ["#F0EDE4", "#2A7A5A", "#C8A96E"],
        colorLabel: "PEARL WHITE",
        rating: 4.7,
        reviewCount: 640,
        featured: false,
        stock: 300,
        sortOrder: 3
    }
];

(async () => {
    await connectDB();
    await Product.deleteMany({});
    await Product.insertMany(products);
    console.log(`✅ Seeded ${products.length} products`);
    await mongoose.connection.close();
    process.exit(0);
})();

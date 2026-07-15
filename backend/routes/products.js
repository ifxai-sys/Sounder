const express = require("express");
const Product = require("../models/Product");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/products ── (public — list all, sorted for landing page)
router.get("/", async (req, res) => {
    try {
        const products = await Product.find().sort({ sortOrder: 1, createdAt: 1 });
        res.status(200).json({ products });
    } catch (error) {
        console.error("Get products error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── GET /api/products/:id ── (public — single product)
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json({ product });
    } catch (error) {
        console.error("Get product error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── POST /api/products ── (protected — create)
router.post("/", protect, adminOnly, async (req, res) => {
    try {
        const {
            name, description, price, oldPrice, image, badge,
            colors, colorLabel, rating, reviewCount, featured, stock, sortOrder
        } = req.body;

        if (!name || !description || price === undefined || !image) {
            return res.status(400).json({ message: "name, description, price, and image are required" });
        }

        const product = await Product.create({
            name, description, price, oldPrice, image, badge,
            colors, colorLabel, rating, reviewCount, featured, stock, sortOrder
        });

        res.status(201).json({ message: "Product created", product });
    } catch (error) {
        console.error("Create product error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── PUT /api/products/:id ── (protected — update)
router.put("/:id", protect, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ message: "Product updated", product });
    } catch (error) {
        console.error("Update product error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── DELETE /api/products/:id ── (protected — delete)
router.delete("/:id", protect, adminOnly, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ message: "Product deleted" });
    } catch (error) {
        console.error("Delete product error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

module.exports = router;

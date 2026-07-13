// Run once to make a user an admin (they must already have an account — sign up first).
// Usage: node make-admin.js someone@example.com

const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");

dotenv.config();

const email = process.argv[2];

if (!email) {
    console.error("Usage: node make-admin.js someone@example.com");
    process.exit(1);
}

(async () => {
    await connectDB();
    const user = await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { isAdmin: true },
        { new: true }
    );

    if (!user) {
        console.error(`❌ No user found with email: ${email}`);
    } else {
        console.log(`✅ ${user.email} is now an admin.`);
    }

    await mongoose.connection.close();
    process.exit(0);
})();

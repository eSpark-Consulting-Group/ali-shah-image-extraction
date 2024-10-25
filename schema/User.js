const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  displayName: { type: String, required: true },
  email: { type: String, required: true },
  refreshToken: { type: String },
  accessToken: { type: String },
  accessTokenIssuedAt: { type: Date }, // New field to store the issued time
});

const User = mongoose.model("User", userSchema);

module.exports = User;

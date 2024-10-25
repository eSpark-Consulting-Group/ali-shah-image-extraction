const axios = require("axios");

const refreshAccessToken = async (refreshToken) => {
  const url = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams();

  params.append("client_id", process.env.GOOGLE_CLIENT_ID);
  params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET);
  params.append("refresh_token", refreshToken);
  params.append("grant_type", "refresh_token");

  try {
    const response = await axios.post(url, params);
    return response.data; // This will contain the new access token and other info
  } catch (error) {
    console.error("Error refreshing access token:", error.response.data);
    throw new Error("Failed to refresh access token");
  }
};

module.exports = { refreshAccessToken };

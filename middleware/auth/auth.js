const { google } = require("googleapis");

async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized, missing bearer token" });
    }

    const accessToken = authHeader.split(" ")[1];

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oAuth2Client.setCredentials({ access_token: accessToken });

    const tokenInfo = await oAuth2Client.getTokenInfo(accessToken);

    req.user = tokenInfo;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}
module.exports = verifyToken;

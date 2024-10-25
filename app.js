const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const session = require("express-session");
require("dotenv").config();
const app = express();
const bodyParser = require("body-parser");
const { v2: cloudinary } = require("cloudinary");
const verifyToken = require("./middleware/auth/auth");

const connectDB = require("./db/db"); // Import the database connection
const User = require("./schema/User");
const { google } = require("googleapis");
const smartdevicemanagement = google.smartdevicemanagement("v1");
const fs = require("fs");
const readline = require("readline");
const { PubSub } = require("@google-cloud/pubsub");
const Snapshot = require("./schema/snapshot"); // Import the Snapshot model

let clientStreams = [];
const { singleImage } = require("./middleware/multer");
const { uploadFilesToCloudinary } = require("./utils/function");
// Configure session
const { refreshAccessToken } = require("./middleware/auth/tokenService");
connectDB();
const KEY_FILE_PATH =
  "middleware/auth/client_secret_774711666046-6gm681i5c8til4aboe9t991rs7kejuc0.apps.googleusercontent.com.json";
const SCOPES = [
  "https://www.googleapis.com/auth/sdm.service",
  "https://www.googleapis.com/auth/cloud-platform", // Full access to all Google Cloud services
  "https://www.googleapis.com/auth/pubsub", // Specific access to Pub/Sub
];
const TOKEN_PATH = "middleware/auth/token.json";

const TOPIC_NAME = process.env.TOPIC_NAME;
const SUBSCRIPTION_NAME = process.env.SUBSCRIPTION_NAME;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this URL:", authUrl);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject("Error retrieving access token");
        oAuth2Client.setCredentials(token);

        // Store the token to disk for later program executions
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log("Token stored to", TOKEN_PATH);
        resolve();
      });
    });
  });
}

async function triggerWebhook(payload, user) {
  try {
    if (clientStreams.length > 0) {
      clientStreams.forEach((stream) => {
        stream.write(`data: ${JSON.stringify(payload)}\n\n`);
      });
    }
  } catch (error) {
    console.error(
      "Error triggering webhook:",
      error.response?.data || error.message
    );
  }
}

// Listen for messages on the specified Pub/Sub topic
async function listenForMessages() {
  const pubSubClient = new PubSub();

  // Create subscription if it doesn't exist
  try {
    await pubSubClient.subscription(SUBSCRIPTION_NAME).get();
    console.log(`Subscription "${SUBSCRIPTION_NAME}" already exists.`);
  } catch (err) {
    if (err.code === 5) {
      // NotFound
      console.log(`Creating subscription "${SUBSCRIPTION_NAME}"...`);
      await pubSubClient
        .topic(TOPIC_NAME)
        .createSubscription(SUBSCRIPTION_NAME);
      console.log(`Subscription "${SUBSCRIPTION_NAME}" created.`);
    } else {
      console.error("Error fetching subscription:", err);
      return;
    }
  }

  // Listen for messages
  const subscription = pubSubClient.subscription(SUBSCRIPTION_NAME);

  // Create a message handler
  const messageHandler = async (message) => {
    // Parse the message data
    const data = JSON.parse(message.data.toString());

    // Check if the event is of type "sdm.devices.events.CameraPerson.Person" and "eventThreadState" is "STARTED"
    const eventType =
      data.resourceUpdate?.events["sdm.devices.events.CameraPerson.Person"];
    const eventThreadState = data.eventThreadState;

    if (eventType && eventThreadState) {
      // Prepare payload for the webhook
      const payload = {
        resourceGroup: data.resourceGroup,
        eventId: data.eventId,
      };

      // Trigger the webhook
      await triggerWebhook(payload, data.userId);
    }

    // Acknowledge the message
    message.ack();
  };

  // Listen for new messages
  subscription.on("message", messageHandler);
}

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(KEY_FILE_PATH, "utf8"));
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
  } else {
    await getNewToken(oAuth2Client);
  }

  return oAuth2Client;
}

app.get("/stream", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");

  clientStreams.push(res);

  // Clean up on disconnect
  req.on("close", () => {
    clientStreams = clientStreams.filter((stream) => stream !== res);
  });
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.json());

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Google strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/sdm.service",
        "https://www.googleapis.com/auth/pubsub",
        "https://www.googleapis.com/auth/cloud-platform",
      ],
      passReqToCallback: true,
      accessType: "offline", // Request offline access to get refresh token
      prompt: "consent",
      session: false,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      let user = await User.findOne({ googleId: profile.id });

      console.log("Received refreshToken:", refreshToken);
      if (!user) {
        // Create a new user if not found
        user = new User({
          googleId: profile.id,
          displayName: profile.displayName,
          email: profile.emails[0].value,
          refreshToken: refreshToken,
          accessToken: accessToken,
          accessTokenIssuedAt: new Date(), // Save the current time
        });
        await user.save(); // Save the new user to the database
      } else {
        // Update existing user with new tokens
        user.refreshToken = refreshToken;
        user.accessToken = accessToken;
        accessTokenIssuedAt: new Date(), // Save the current time
          await user.save(); // Save the updated user to the database
      }
      profile.issuedAt = Date.now();

      // Save user profile and tokens to the session or database

      req.session.refreshToken = refreshToken;
      req.session.accessToken = accessToken;

      return done(null, { profile, refreshToken, accessToken });
    }
  )
);

app.get("/snapshots", verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;
    const totalItems = await Snapshot.countDocuments();
    const items = await Snapshot.find().skip(skip).limit(limit);

    const totalPages = Math.ceil(totalItems / limit);
    res.status(200).json({
      totalItems,
      totalPages,
      currentPage: page,
      pageSize: items.length,
      items,
    });
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    res.status(500).json({ message: "Failed to fetch snapshots" });
  }
});

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user.profile);
});

// Deserialize user from the session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Route to start the authentication process
app.get(
  "/auth/google",
  passport.authenticate("google", {
    accessType: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/sdm.service",
      "https://www.googleapis.com/auth/pubsub",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  })
);

// Callback route after Google has authenticated the user
app.get(
  "/api/auth/google/redirect",
  passport.authenticate("google", {
    failureRedirect: "/",
  }),
  (req, res) => {
    req.session.refreshToken = req.user.refreshToken; // Store refresh token in session
    req.session.accessToken = req.user.accessToken;

    // Successful authentication, redirect home.
    res.redirect("/profile");
  }
);

// Route to get the user's profile and refresh token
app.get("/profile", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }
  res.json({
    user: req.user,
    refreshToken: req.session.refreshToken, // Access the refresh token
  });
});

app.post("/saveSnapshot", singleImage, async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return next(new ErrorHandler("Please upload an image", 400));
  }

  const result = await uploadFilesToCloudinary([file]);

  const snapShot = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const eventId = req.body.eventId;
  const resourceGroup = req.body.resourceGroup;

  // Create a new snapshot document
  const newSnapshot = new Snapshot({
    eventId: eventId,
    resourceGroup: resourceGroup,
    snapShot: snapShot,
  });

  try {
    await newSnapshot.save();
    res
      .status(201)
      .json({ message: "Snapshot saved successfully", snapshot: newSnapshot });
  } catch (error) {
    console.error("Error saving snapshot:", error);
    return next(new ErrorHandler("Failed to save snapshot", 500));
  }
});

app.get("/getDevices", async (req, res) => {
  try {
    // Authorize the request
    const authClient = await authorize();

    // Fetch devices
    const response = await smartdevicemanagement.enterprises.devices.list({
      auth: authClient,
      parent: "enterprises/f311ed2e-cb1c-4758-a8fb-0ac86ccc179a", // Replace with your actual enterprise ID
    });

    const devices = response.data.devices;

    if (devices && devices.length) {
      return res.status(200).json({ devices });
    } else {
      console.log("No devices found.");
      return res.status(404).json({ message: "No devices found." });
    }
  } catch (error) {
    console.error("Error fetching devices:", error);
    return res.status(500).json({ error: "Failed to retrieve devices." });
  }
});

app.get("/some-protected-route", async (req, res) => {
  try {
    const refreshToken = req.session.refreshToken;

    // Check if the access token is expired (you may need to implement your own logic here)
    if (isAccessTokenExpired(req.user)) {
      const newTokens = await refreshAccessToken(refreshToken);
      req.user.accessToken = newTokens.access_token; // Update the access token in the user object
      req.user.issuedAt = Date.now();
      // Optionally, save the new access token to the database if needed
      await User.updateOne(
        { googleId: req.user.googleId },
        { accessToken: newTokens.access_token },
        { accessTokenIssuedAt: newTokens.expires_in }
      );
    }

    // // Now you can use the access token to make API calls
    // const apiResponse = await axios.get("https://someapi.com/protected", {
    //   headers: {
    //     Authorization: `Bearer ${req.user.accessToken}`,
    //   },
    // });

    // res.json(apiResponse.data);
    res.json({ Data: "Refresh Token" });
  } catch (error) {
    console.error("Error accessing protected route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Function to check if the access token is expired
const isAccessTokenExpired = (user) => {
  const expiresIn = 3600; // The expiration time in seconds (1 hour)
  const issuedAt = user.issuedAt; // The time when the token was issued
  const currentTime = new Date(); // Current time

  // Check if the current time exceeds the issued time plus the expiration duration
  return currentTime - issuedAt > expiresIn * 1000; // Convert seconds to milliseconds
};

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  try {
    console.log("OAuth2 client authorized");
    await authorize();

    await listenForMessages();
  } catch (err) {
    console.error("Failed to authorize OAuth2 client:", err);
  }
});

const mongoose = require("mongoose");

const snapshotSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  resourceGroup: { type: String, required: true },
  snapShot: {
    public_id: { type: String, required: true },
    url: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now }, // Optional: to track when the snapshot was created
});

const Snapshot = mongoose.model("Snapshot", snapshotSchema);

module.exports = Snapshot;

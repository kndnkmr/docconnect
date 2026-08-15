// ============================================
// Counter Model - atomic sequence generator
// ============================================
// MongoDB has no built-in auto-increment (unlike SQL's AUTO_INCREMENT).
// This is the standard workaround: a tiny collection with one document per
// named counter (e.g. "patientId"), incremented atomically with
// findOneAndUpdate + $inc so concurrent requests never hand out the same
// number twice.

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // counter name, e.g. "patientId"
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

// Atomically returns the next number for the given counter name, creating
// the counter (starting at 1) if it doesn't exist yet.
async function getNextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { Counter, getNextSequence };

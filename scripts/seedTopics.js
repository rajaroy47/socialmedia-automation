// scripts/seedTopics.js
//
// Run this from the server/ directory:
//   node scripts/seedTopics.js
//
// Inserts every topic below into MongoDB via the VideoTopic model, letting
// mongoose handle `order` auto-numbering after whatever already exists.

import dotenv from "dotenv";
import mongoose from "mongoose";
import VideoTopic from "../src/models/videoTopic.model.js";

dotenv.config();

const topics = [
    "Bermuda Triangle ka sach kya hai",
    "Human brain ke amazing facts",
    "Titanic dubne ke peeche ki kahani",
    "Space mein astronaut kaise sote hain",
    "Ancient Egypt ke pyramids ka raaz",
    "Octopus ke 3 dil kyun hote hain",
    "Chanakya ki 5 powerful life lessons",
    "Black hole kya hota hai simple language mein",
    "Great Wall of China ka itihas",
    "Human body ke 5 hairaan karne wale facts",
    "Dinosaur extinct kyun hue the",
    "Moon par pehla insaan kaun gaya tha",
    "Sharks ke baare mein 5 myths jo galat hain",
    "Antarctica mein kya kya chhupa hai",
    "Sapno ka science kya kehta hai",
    "Amazon jungle ke hairaan karne wale facts",
    "Einstein ki zindagi ke unknown facts",
    "Deep sea creatures jo aliens jaise dikhte hain",
    "Money psychology - hum paisa kyun waste karte hain",
    "Ancient Rome ke gladiators ki kahani",
    "Human memory kaise kaam karti hai",
    "Sahara desert kabhi hara bhara tha",
    "Time travel possible hai kya science ke hisab se",
    "Honey kabhi kharab kyun nahi hota",
    "Great Depression 1929 ki kahani",
    "Human eyes ke baare mein amazing facts",
    "Vikings kaun the aur kaise rehte the",
    "Artificial Intelligence hamara future kaise badlega",
    "Everest par chadhna itna mushkil kyun hai",
    "Ancient India ki 5 advanced techniques jo aaj bhi hairaan karti hain",
];

async function run() {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/social-automation";
    await mongoose.connect(MONGO_URI);
    console.log("Connected to", MONGO_URI);

    const existingCount = await VideoTopic.countDocuments();

    const docs = topics.map((topicName, i) => ({
        topicName,
        order: existingCount + i + 1,
    }));

    const created = await VideoTopic.insertMany(docs, { ordered: true });
    console.log(`Inserted ${created.length} topics (order ${existingCount + 1} - ${existingCount + docs.length})`);

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error("Seed failed:", err.message);
    process.exit(1);
});
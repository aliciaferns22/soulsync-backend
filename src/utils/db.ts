import mongoose from "mongoose";
import { logger } from "./logger";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://aliciaferns_db_user:soulsync123@ac-f3ntqub-shard-00-00.laypnrd.mongodb.net:27017,ac-f3ntqub-shard-00-01.laypnrd.mongodb.net:27017,ac-f3ntqub-shard-00-02.laypnrd.mongodb.net:27017/ai-therapist?ssl=true&replicaSet=atlas-f2j2ae-shard-0&authSource=admin&appName=Cluster0";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info("Connected to MongoDB Atlas");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

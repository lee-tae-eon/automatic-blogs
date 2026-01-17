import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: [
    path.join(__dirname, "../../../.env.local"),
    path.join(__dirname, "../../../.env"),
  ],
});

export const ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
  GEMINI_MODEL_FAST: process.env.GEMINI_MODEL_FAST!,
};

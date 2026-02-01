import { findProjectRoot } from "@blog-automation/core";
import dotenv from "dotenv";
import path from "path";

const projectRoot = findProjectRoot(__dirname);
const envPath = path.join(projectRoot, ".env");

dotenv.config({
  path: [envPath],
});

export const ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_SUB_KEY!,
  GEMINI_MODEL_FAST: process.env.GEMINI_MODEL_FAST!,
  GEMINI_MODEL_NORMAL: process.env.GEMINI_MODEL_NORMAL!,
};

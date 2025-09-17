import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT),
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR),
  BASE_URL: process.env.BASE_URL,
};

// src/config/zernio.config.js

import dotenv from "dotenv";
import Zernio from "@zernio/node";
import { logger } from "../utils/logger.js";

dotenv.config();

if (!process.env.ZERNIO_API_KEY) {
    logger.error("ZERNIO_API_KEY is not set in .env");
    process.exit(1);
}

logger.info(
    "Zernio API Key found:",
    process.env.ZERNIO_API_KEY.substring(0, 10) + "..."
);

const zernio = new Zernio({
    apiKey: process.env.ZERNIO_API_KEY,
    timeout: 60000,
});

/**
 * Quick sanity check used by the /youtube/test and /instagram/test routes.
 */
export async function testZernioConnection() {
    const accounts = await zernio.accounts.list();
    return accounts;
}

export default zernio;

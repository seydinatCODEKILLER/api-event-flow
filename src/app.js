import express from "express";
import cors from "cors";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import logger from "./config/logger.js";
import { getCorsOptions } from "./config/cors.js";
import { generalLimiter } from "./config/rateLimiter.js";
import { swaggerOptions } from "./config/swagger.js";
import { errorHandler, notFoundHandler } from "./shared/middlewares/error.middleware.js";
import { env } from "./config/env.js";

const app = express();
const specs = swaggerJSDoc(swaggerOptions);

// ─── Trust proxy (DOIT être en premier) ──────────────────────
app.set("trust proxy", 1);

// ─── Middlewares globaux ──────────────────────────────────────
app.use(cors(getCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Documentation Swagger ────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(specs));

// ─── Rate limiter général ─────────────────────────────────────
app.use("/api", generalLimiter);

// ─── Routes ───────────────────────────────────────────────────
import authRoutes from "./modules/auth/auth.routes.js";
import eventRoutes from "./modules/events/event.routes.js";
import participantRoutes from "./modules/participants/participant.routes.js";
// import ticketRoutes from "./modules/tickets/ticket.routes.js";
// import syncRoutes from "./modules/sync/sync.routes.js";
// import statsRoutes from "./modules/stats/stats.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events/:eventId/participants", participantRoutes);
// app.use("/api/tickets", ticketRoutes);
// app.use("/api/sync", syncRoutes);
// app.use("/api/stats", statsRoutes);

// ─── Health check ─────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "EventFlow API is running",
    version: "1.0.0",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 + Error handler (toujours en dernier) ────────────────
app.all("/{*path}", notFoundHandler);
app.use(errorHandler);

logger.info(`EventFlow API initialized — ${env.NODE_ENV}`);

export default app;
import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/database.js";
import { env } from "./config/env.js";
import logger from "./config/logger.js";

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connecté via Prisma");

    const server = app.listen(env.PORT, "0.0.0.0", () => {
      logger.info(`EventFlow API démarrée sur http://localhost:${env.PORT}`);
      logger.info(`Swagger docs : http://localhost:${env.PORT}/api/docs`);
      logger.info(`Environnement : ${env.NODE_ENV}`);
    });

    const shutdown = async (signal) => {
      logger.warn(`Signal ${signal} reçu — arrêt en cours...`);

      server.close(async () => {
        await prisma.$disconnect();
        logger.info("Serveur arrêté proprement");
        process.exit(0);
      });

      setTimeout(() => {
        logger.error("Arrêt forcé après timeout de 10s");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    process.on("unhandledRejection", (reason) => {
      logger.error({ reason }, "Unhandled promise rejection");
    });

    process.on("uncaughtException", (err) => {
      logger.fatal({ err }, "Uncaught exception — arrêt forcé");
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, "Erreur de démarrage");
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();

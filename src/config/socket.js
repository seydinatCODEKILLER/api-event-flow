import { Server } from "socket.io";
import TokenGenerator from "./jwt.js";
import { prisma } from "./database.js";
import logger from "./logger.js";

const tokenGenerator = new TokenGenerator();

let io = null;

// ─── Initialisation ────────────────────────────────────────────
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Middleware auth ──────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("TOKEN_MISSING"));

      const decoded = tokenGenerator.verify(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
        },
      });

      if (!user) return next(new Error("USER_NOT_FOUND"));
      if (user.status === "PENDING") return next(new Error("ACCOUNT_PENDING"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("TOKEN_INVALID"));
    }
  });

  // ─── Connexion ────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const { id, fullName } = socket.user;

    logger.info({ userId: id, socketId: socket.id }, `🔌 ${fullName} connecté`);

    // Room personnelle — notifs ciblées
    socket.join(`user:${id}`);

    // ─── Rejoindre la room d'un event ─────────────────────────
    // Appelé par l'organisateur quand il ouvre le dashboard de son event
    // ou par le modérateur quand il démarre une session de scan
    socket.on("join:event", ({ eventId }) => {
      if (!eventId) return;
      socket.join(`event:${eventId}`);
      logger.info(
        { userId: id, eventId },
        `${fullName} a rejoint la room event:${eventId}`,
      );
    });

    // ─── Quitter la room d'un event ───────────────────────────
    socket.on("leave:event", ({ eventId }) => {
      if (!eventId) return;
      socket.leave(`event:${eventId}`);
      logger.info(
        { userId: id, eventId },
        `${fullName} a quitté la room event:${eventId}`,
      );
    });

    // ─── Déconnexion ──────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      logger.info(
        { userId: id, socketId: socket.id, reason },
        `🔌 ${fullName} déconnecté`,
      );
    });

    // ─── Erreur ───────────────────────────────────────────────
    socket.on("error", (err) => {
      logger.error({ userId: id, err }, "Erreur socket");
    });
  });

  logger.info("Socket.io initialisé");
  return io;
};

// ─── Getter global ─────────────────────────────────────────────
export const getIO = () => {
  if (!io) throw new Error("Socket.io non initialisé");
  return io;
};

// ─── Helpers d'émission ────────────────────────────────────────

// Notif ciblée à un user spécifique
export const emitToUser = (userId, event, data) => {
  getIO().to(`user:${userId}`).emit(event, data);
};

// Stats live à tous les membres d'un event (organisateur + modérateurs)
export const emitToEvent = (eventId, event, data) => {
  getIO().to(`event:${eventId}`).emit(event, data);
};

// Broadcast global
export const emitToAll = (event, data) => {
  getIO().emit(event, data);
};

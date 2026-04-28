import { prisma } from "../../config/database.js";
import TokenGenerator from "../../config/jwt.js";
import {
  UnauthorizedError,
  ForbiddenError,
  AppError,
} from "../errors/AppError.js";

const tokenGenerator = new TokenGenerator();

// ─── Helper privé : Extraction du token ──────────────────────
const extractBearerToken = (req) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Token manquant ou format invalide");
  }
  return header.split(" ")[1];
};

// ─── authenticate — vérifie le JWT et attache req.user ───────
export const authenticate = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token manquant ou format invalide");
    }

    const token = header.split(" ")[1];
    const decoded = tokenGenerator.verify(token);

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!currentUser) {
      throw new UnauthorizedError(
        "Token appartient à un utilisateur qui n'existe plus",
      );
    }

    req.user = currentUser;
    next();
  } catch (err) {
    next(
      err instanceof AppError
        ? err
        : new UnauthorizedError("Token invalide ou session expirée"),
    );
  }
};

// ─── requireRole — restriction par rôle ──────────────────────
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          "Vous n'avez pas la permission d'effectuer cette action",
        ),
      );
    }
    next();
  };

// ─── requireEventAccess — vérifie l'accès à un événement ─────
export const requireEventAccess = async (req, _res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    if (!eventId) return next();

    const { id: userId, role } = req.user;

    if (role === "ORGANIZER") {
      const event = await prisma.event.findFirst({
        where: { id: eventId, organizerId: userId },
        select: { id: true },
      });

      if (!event) {
        return next(new ForbiddenError("Accès non autorisé à cet événement"));
      }

      return next();
    }

    if (role === "MODERATOR") {
      const assignment = await prisma.eventModerator.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { id: true },
      });

      if (!assignment) {
        return next(
          new ForbiddenError("Vous n'êtes pas assigné à cet événement"),
        );
      }

      return next();
    }

    return next(new ForbiddenError("Rôle non reconnu"));
  } catch (err) {
    next(new ForbiddenError("Erreur de vérification d'accès"));
  }
};

export const authenticateParticipant = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req);
    const payload = tokenGenerator.verify(token);

    // Vérifier que c'est bien un token participant
    if (payload.role !== "PARTICIPANT") {
      throw new UnauthorizedError("Accès réservé aux participants");
    }

    const participant = await prisma.participant.findUnique({
      where: { id: payload.id },
      select: { id: true, fullName: true, email: true, status: true },
    });

    if (!participant) throw new UnauthorizedError("Participant introuvable");
    if (participant.status === "PENDING") {
      throw new UnauthorizedError("Compte non activé");
    }

    req.participant = participant;
    next();
  } catch (error) {
    next(error);
  }
};

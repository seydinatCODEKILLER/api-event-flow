import { prisma } from "../../config/database.js";
import TokenGenerator from "../../config/jwt.js";
import {
  UnauthorizedError,
  ForbiddenError,
  AppError,
} from "../errors/AppError.js";

const tokenGenerator = new TokenGenerator();

/**
 * Middleware d'authentification unifié.
 * Vérifie le JWT et attache req.user.
 * Fonctionne pour tous les utilisateurs (plus de séparation staff/participant).
 */
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
        fullName: true,
        email: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!currentUser) {
      throw new UnauthorizedError(
        "Token appartient à un utilisateur qui n'existe plus",
      );
    }

    // Sécurité : bloquer les comptes non vérifiés
    if (currentUser.status === "PENDING") {
      throw new UnauthorizedError(
        "Veuillez vérifier votre adresse email avant de continuer",
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

/**
 * Vérifie que l'utilisateur connecté est organisateur OU modérateur d'un événement.
 * Ne se base plus sur un champ "role" fixe — le rôle est contextuel.
 */
export const requireEventAccess = async (req, _res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    if (!eventId) return next();

    const { id: userId } = req.user;

    // Vérifier si l'utilisateur est l'organisateur
    const asOrganizer = await prisma.event.findFirst({
      where: { id: eventId, organizerId: userId },
      select: { id: true },
    });

    if (asOrganizer) return next();

    // Vérifier si l'utilisateur est modérateur assigné
    const asModerator = await prisma.eventModerator.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    });

    if (asModerator) return next();

    return next(
      new ForbiddenError("Vous n'avez pas accès à cet événement"),
    );
  } catch (err) {
    next(new ForbiddenError("Erreur de vérification d'accès"));
  }
};
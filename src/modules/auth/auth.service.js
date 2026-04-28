import { AuthRepository } from "./auth.repository.js";
import TokenGenerator from "../../config/jwt.js";
import { hashPassword, comparePassword } from "../../shared/utils/hasher.js";
import MediaUploader from "../../shared/utils/uploader.js";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js";

const authRepo = new AuthRepository();
const tokenGenerator = new TokenGenerator();

// Timing attack prevention
const DUMMY_HASH = env.DUMMY_HASH;

// ─── Helpers privés ───────────────────────────────────────────

const buildTokenPayload = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
});

const buildUserResponse = (user) => ({
  id: user.id,
  nom: user.nom,
  prenom: user.prenom,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const createTokenPair = async (
  user,
  deviceId = null,
  userAgent = null,
  ipAddress = null,
) => {
  const payload = buildTokenPayload(user);
  const accessToken = tokenGenerator.sign(payload);
  const refreshToken = tokenGenerator.signRefresh(payload);

  await authRepo.createRefreshToken({
    token: refreshToken,
    userId: user.id,
    deviceId,
    userAgent,
    ipAddress,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30j
  });

  return { accessToken, refreshToken };
};

// ─── Helpers participant ──────────────────────────────────────

const buildParticipantPayload = (participant) => ({
  id: participant.id,
  email: participant.email,
  role: "PARTICIPANT", // rôle fixe
});

const buildParticipantResponse = (participant) => ({
  id: participant.id,
  fullName: participant.fullName,
  email: participant.email,
  phone: participant.phone ?? null,
  status: participant.status,
  avatarUrl: participant.avatarUrl ?? null,
  createdAt: participant.createdAt,
  updatedAt: participant.updatedAt,
});

const createParticipantTokenPair = async (
  participant,
  deviceId = null,
  userAgent = null,
  ipAddress = null,
) => {
  const payload = buildParticipantPayload(participant);
  const accessToken = tokenGenerator.sign(payload);
  const refreshToken = tokenGenerator.signRefresh(payload);

  await authRepo.createParticipantRefreshToken({
    token: refreshToken,
    participantId: participant.id,
    deviceId,
    userAgent,
    ipAddress,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken };
};

// ─── Service ──────────────────────────────────────────────────

export class AuthService {
  // ─── Inscription ──────────────────────────────────────────────
  async register(data, file) {
    const { nom, prenom, email, password, role } = data;

    const existing = await authRepo.findByEmail(email);
    if (existing) {
      throw new ConflictError("Un compte avec cet email existe déjà");
    }

    const uploader = new MediaUploader();
    let avatarUrl = null;
    let avatarPublicId = null;

    if (file) {
      const result = await uploader.upload(
        file,
        "eventflow/avatars",
        `user_${Date.now()}`,
      );
      avatarUrl = result.url;
      avatarPublicId = result.public_id;
    }

    try {
      const hashedPassword = await hashPassword(password);

      const user = await authRepo.create({
        nom,
        prenom,
        email,
        password: hashedPassword,
        role,
        avatarUrl,
        avatarPublicId,
      });

      const { accessToken, refreshToken } = await createTokenPair(user);

      return {
        user: buildUserResponse(user),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (avatarUrl) {
        await uploader.deleteByUrl(avatarUrl).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Connexion ────────────────────────────────────────────────
  async login(email, password, meta = {}) {
    const user = await authRepo.findByEmail(email);

    // Timing attack prevention — toujours comparer même si user introuvable
    if (!user) {
      await comparePassword(password, DUMMY_HASH);
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    const { accessToken, refreshToken } = await createTokenPair(
      user,
      meta.deviceId,
      meta.userAgent,
      meta.ipAddress,
    );

    return {
      user: buildUserResponse(user),
      accessToken,
      refreshToken,
    };
  }

  // ─── Profil courant ───────────────────────────────────────────
  async getCurrentUser(userId) {
    const user = await authRepo.findByIdFull(userId);
    if (!user) throw new NotFoundError("Utilisateur");
    return user;
  }

  // ─── Mise à jour du profil ────────────────────────────────────
  async updateProfile(userId, data, file) {
    const user = await authRepo.findById(userId);
    if (!user) throw new NotFoundError("Utilisateur");

    const uploader = new MediaUploader();
    let newAvatarUrl = null;
    let newAvatarPublicId = null;

    if (file) {
      const result = await uploader.upload(
        file,
        "eventflow/avatars",
        `user_${userId}_${Date.now()}`,
      );
      newAvatarUrl = result.url;
      newAvatarPublicId = result.public_id;

      // Supprimer l'ancien avatar Cloudinary
      if (user.avatarPublicId) {
        await uploader.rollback(user.avatarPublicId).catch(() => {});
      }
    }

    try {
      const updated = await authRepo.updateUser(userId, {
        ...(data.nom && { nom: data.nom }),
        ...(data.prenom && { prenom: data.prenom }),
        ...(newAvatarUrl && { avatarUrl: newAvatarUrl }),
        ...(newAvatarPublicId && { avatarPublicId: newAvatarPublicId }),
      });

      return buildUserResponse(updated);
    } catch (error) {
      if (newAvatarUrl) {
        await uploader.deleteByUrl(newAvatarUrl).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Refresh token ────────────────────────────────────────────
  async refreshToken(token) {
    const stored = await authRepo.findRefreshToken(token);

    if (!stored) {
      throw new UnauthorizedError("Refresh token invalide");
    }

    // Token révoqué → révoquer tous les tokens (détection réutilisation)
    if (stored.revokedAt !== null) {
      await authRepo.revokeAllUserTokens(stored.userId);
      throw new UnauthorizedError(
        "Session compromise — tous vos appareils ont été déconnectés",
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
    }

    const { user } = stored;

    // Rotation : révoquer l'ancien, créer un nouveau
    const newAccessToken = tokenGenerator.sign(buildTokenPayload(user));
    const newRefreshToken = tokenGenerator.signRefresh(buildTokenPayload(user));

    await Promise.all([
      authRepo.revokeRefreshToken(token),
      authRepo.createRefreshToken({
        token: newRefreshToken,
        userId: user.id,
        deviceId: stored.deviceId,
        userAgent: stored.userAgent,
        ipAddress: stored.ipAddress,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
    ]);

    return {
      user: buildUserResponse(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ─── Déconnexion ──────────────────────────────────────────────
  async logout(token) {
    if (token) {
      await authRepo.revokeRefreshToken(token).catch(() => {});
    }
  }

  // ─── Révoquer tous les tokens ─────────────────────────────────
  async revokeAllTokens(userId) {
    await authRepo.revokeAllUserTokens(userId);
  }

  async registerParticipant(data) {
    const { fullName, email, password, phone } = data;

    const existing = await authRepo.findParticipantByEmail(email);
    if (existing) {
      throw new ConflictError("Un compte avec cet email existe déjà");
    }

    const hashedPassword = await hashPassword(password);

    const participant = await authRepo.createParticipant({
      fullName,
      email,
      phone: phone ?? null,
      password: hashedPassword,
      status: "ACTIVE", // auto-inscrit → actif immédiatement
    });

    const { accessToken, refreshToken } =
      await createParticipantTokenPair(participant);

    return {
      participant: buildParticipantResponse(participant),
      accessToken,
      refreshToken,
    };
  }

  async loginParticipant(email, password, meta = {}) {
    const participant = await authRepo.findParticipantByEmail(email);

    if (!participant) {
      await comparePassword(password, DUMMY_HASH);
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    // Participant ajouté manuellement mais pas encore activé
    if (participant.status === "PENDING") {
      throw new UnauthorizedError(
        "Votre compte n'est pas encore activé. Vérifiez votre email.",
      );
    }

    // Participant sans mot de passe (ajouté manuellement, pas encore activé)
    if (!participant.password) {
      await comparePassword(password, DUMMY_HASH);
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    const isValid = await comparePassword(password, participant.password);
    if (!isValid) {
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    const { accessToken, refreshToken } = await createParticipantTokenPair(
      participant,
      meta.deviceId,
      meta.userAgent,
      meta.ipAddress,
    );

    return {
      participant: buildParticipantResponse(participant),
      accessToken,
      refreshToken,
    };
  }

  async activateParticipantAccount(token, password) {
    const participant = await authRepo.findParticipantByActivationToken(token);

    if (!participant) {
      throw new NotFoundError("Token d'activation invalide");
    }

    if (participant.activationExpiresAt < new Date()) {
      throw new UnauthorizedError(
        "Token d'activation expiré. Contactez l'organisateur.",
      );
    }

    if (participant.status === "ACTIVE") {
      throw new ConflictError("Ce compte est déjà activé");
    }

    const hashedPassword = await hashPassword(password);

    const updated = await authRepo.updateParticipant(participant.id, {
      password: hashedPassword,
      status: "ACTIVE",
      activationToken: null,
      activationExpiresAt: null,
    });

    const { accessToken, refreshToken } =
      await createParticipantTokenPair(updated);

    return {
      participant: buildParticipantResponse(updated),
      accessToken,
      refreshToken,
    };
  }

  async refreshParticipantToken(token) {
    const stored = await authRepo.findParticipantRefreshToken(token);

    if (!stored) throw new UnauthorizedError("Refresh token invalide");

    if (stored.revokedAt !== null) {
      await authRepo.revokeAllParticipantTokens(stored.participantId);
      throw new UnauthorizedError(
        "Session compromise — tous vos appareils ont été déconnectés",
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Session expirée, veuillez vous reconnecter");
    }

    const { participant } = stored;
    const newAccessToken = tokenGenerator.sign(
      buildParticipantPayload(participant),
    );
    const newRefreshToken = tokenGenerator.signRefresh(
      buildParticipantPayload(participant),
    );

    await Promise.all([
      authRepo.revokeParticipantRefreshToken(token),
      authRepo.createParticipantRefreshToken({
        token: newRefreshToken,
        participantId: participant.id,
        deviceId: stored.deviceId,
        userAgent: stored.userAgent,
        ipAddress: stored.ipAddress,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
    ]);

    return {
      participant: buildParticipantResponse(participant),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logoutParticipant(token) {
    if (token) {
      await authRepo.revokeParticipantRefreshToken(token).catch(() => {});
    }
  }

  async getCurrentParticipant(participantId) {
    const participant = await authRepo.findParticipantById(participantId);
    if (!participant) throw new NotFoundError("Participant");
    return participant;
  }
}

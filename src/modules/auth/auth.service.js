import crypto from "crypto";
import { AuthRepository } from "./auth.repository.js";
import TokenGenerator from "../../config/jwt.js";
import { hashPassword, comparePassword } from "../../shared/utils/hasher.js";
import MediaUploader from "../../shared/utils/uploader.js";
import { sendEmail } from "../../config/mailer.js";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from "../../shared/errors/AppError.js";
import { env } from "../../config/env.js";
import { verificationEmailTemplate } from "../../shared/templates/verificationEmail.template.js";

const authRepo = new AuthRepository();
const tokenGenerator = new TokenGenerator();

// Timing attack prevention
const DUMMY_HASH = env.DUMMY_HASH;

// ─── Constantes ──────────────────────────────────────────────

const VERIFICATION_TOKEN_EXPIRES = 24 * 60 * 60 * 1000; // 24h
const REFRESH_TOKEN_EXPIRES = 30 * 24 * 60 * 60 * 1000; // 30j

// ─── Helpers privés ──────────────────────────────────────────

const buildTokenPayload = (user) => ({
  id: user.id,
  email: user.email,
});

const buildUserResponse = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone ?? null,
  status: user.status,
  avatarUrl: user.avatarUrl ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const createTokenPair = async (user, meta = {}) => {
  const payload = buildTokenPayload(user);
  const accessToken = tokenGenerator.sign(payload);
  const refreshToken = tokenGenerator.signRefresh(payload);

  await authRepo.createRefreshToken({
    token: refreshToken,
    userId: user.id,
    deviceId: meta.deviceId || null,
    userAgent: meta.userAgent || null,
    ipAddress: meta.ipAddress || null,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES),
  });

  return { accessToken, refreshToken };
};

const generateVerificationToken = () => crypto.randomBytes(32).toString("hex");

// ─── Service ──────────────────────────────────────────────────

export class AuthService {
  /**
   * Inscription — crée un compte en statut PENDING, envoie l'email de vérification.
   * Ne retourne PAS de tokens : l'utilisateur doit d'abord vérifier son email.
   */
  async register(data, file) {
    const { fullName, email, password, phone } = data;

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
      const verificationToken = generateVerificationToken();

      const user = await authRepo.create({
        fullName,
        email,
        phone: phone ?? null,
        password: hashedPassword,
        avatarUrl,
        avatarPublicId,
        status: "PENDING",
        verificationToken,
        verificationExpiresAt: new Date(
          Date.now() + VERIFICATION_TOKEN_EXPIRES,
        ),
      });

      // Envoi de l'email de vérification
      const webUrl = env.IS_PROD ? env.WEB_URL : env.WEB_URL_DEV;
      const verificationLink = `${webUrl}/verify-email?token=${verificationToken}`;

      await sendEmail({
        to: user.email,
        toName: user.fullName,
        subject: "Vérifiez votre adresse email — EventFlow",
        html: verificationEmailTemplate({
          userName: user.fullName,
          verificationLink,
        }),
      }).catch((err) => {
        console.error("Échec envoi email de vérification:", err);
      });

      return {
        user: buildUserResponse(user),
      };
    } catch (error) {
      if (avatarUrl) {
        await uploader.deleteByUrl(avatarUrl).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Vérification email — valide le token, passe le compte en ACTIVE,
   * retourne les tokens pour auto-login après vérification.
   */
  async verifyEmail(token) {
    const user = await authRepo.findByVerificationToken(token);

    if (!user) {
      throw new NotFoundError("Token de vérification invalide");
    }

    if (user.status === "ACTIVE") {
      throw new ConflictError("Ce compte est déjà vérifié");
    }

    if (user.verificationExpiresAt < new Date()) {
      throw new UnauthorizedError(
        "Token de vérification expiré. Veuillez demander un nouvel email.",
      );
    }

    const updated = await authRepo.update(user.id, {
      status: "ACTIVE",
      verificationToken: null,
      verificationExpiresAt: null,
    });

    const tokens = await createTokenPair(updated);

    return {
      user: buildUserResponse(updated),
      ...tokens,
    };
  }

  /**
   * Connexion — vérifie les identifiants et le statut ACTIVE.
   */
  async login(email, password, meta = {}) {
    const user = await authRepo.findByEmail(email);

    // Timing attack prevention
    if (!user) {
      await comparePassword(password, DUMMY_HASH);
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    if (user.status === "PENDING") {
      throw new UnauthorizedError(
        "Veuillez vérifier votre adresse email avant de vous connecter",
      );
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedError("Email ou mot de passe incorrect");
    }

    const tokens = await createTokenPair(user, meta);

    return {
      user: buildUserResponse(user),
      ...tokens,
    };
  }

  /**
   * Profil de l'utilisateur connecté.
   */
  async getCurrentUser(userId) {
    const user = await authRepo.findById(userId);
    if (!user) throw new NotFoundError("Utilisateur");
    return user;
  }

  /**
   * Mise à jour du profil (fullName, phone, avatar).
   */
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
      const updateData = {};

      if (data.fullName) updateData.fullName = data.fullName;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (newAvatarUrl) updateData.avatarUrl = newAvatarUrl;
      if (newAvatarPublicId) updateData.avatarPublicId = newAvatarPublicId;

      const updated = await authRepo.update(userId, updateData);

      return buildUserResponse(updated);
    } catch (error) {
      if (newAvatarUrl) {
        await uploader.deleteByUrl(newAvatarUrl).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Refresh token — rotation avec détection de réutilisation.
   */
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
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES),
      }),
    ]);

    return {
      user: buildUserResponse(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Déconnexion — révoque le refresh token fourni.
   */
  async logout(token) {
    if (token) {
      await authRepo.revokeRefreshToken(token).catch(() => {});
    }
  }

  /**
   * Déconnecter tous les appareils.
   */
  async revokeAllTokens(userId) {
    await authRepo.revokeAllUserTokens(userId);
  }

  // ... tes méthodes existantes (register, verifyEmail, login, etc.)

  /**
   * Activation compte public — utilisé après inscription via lien public.
   * Valide le token ET définit le mot de passe pour la 1ère fois.
   */
  async activatePublicAccount(token, password) {
    const user = await authRepo.findByVerificationToken(token);

    if (!user) {
      throw new NotFoundError("Lien d'activation invalide");
    }

    if (user.status === "ACTIVE") {
      throw new ConflictError(
        "Ce compte est déjà vérifié. Veuillez vous connecter.",
      );
    }

    if (user.verificationExpiresAt < new Date()) {
      throw new UnauthorizedError(
        "Lien d'activation expiré. Veuillez demander un nouveau lien.",
      );
    }

    const hashedPassword = await hashPassword(password);

    const updated = await authRepo.update(user.id, {
      password: hashedPassword,
      status: "ACTIVE",
      verificationToken: null,
      verificationExpiresAt: null,
    });

    // On génère les tokens pour le connecter direct (comme dans ton verifyEmail)
    const tokens = await createTokenPair(updated);

    return {
      user: buildUserResponse(updated),
      ...tokens,
    };
  }
}

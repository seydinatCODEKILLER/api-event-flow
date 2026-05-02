import { UserRepository } from "./user.repository.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../shared/errors/AppError.js";
import MediaUploader from "../../shared/utils/uploader.js";

const userRepo = new UserRepository();

export class UserService {
  // ─── Obtenir mon profil ──────────────────────────────────────
  async getMe(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("Utilisateur");
    return user;
  }

  // ─── Modifier mon profil ─────────────────────────────────────
  async updateProfile(userId, data, file = null) {
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("Utilisateur");

    const uploader = new MediaUploader();
    let newAvatarUrl = null;
    let newAvatarPublicId = null;

    if (file) {
      const result = await uploader.upload(
        file,
        "eventflow/avatars",
        `avatar_${userId}`,
      );
      newAvatarUrl = result.url;
      newAvatarPublicId = result.public_id;
    }

    try {
      const updateData = {};
      if (data.fullName) updateData.fullName = data.fullName;
      if (data.email) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (newAvatarUrl) updateData.avatarUrl = newAvatarUrl;
      if (newAvatarPublicId) updateData.avatarPublicId = newAvatarPublicId;

      const updated = await userRepo.update(userId, updateData);

      // Supprimer l'ancien avatar de Cloudinary si on en a uploadé un nouveau
      // (On récupère l'ancien publicId avant la mise à jour si besoin, ici on le déduit)
      // Note: Pour être parfait, il faudrait sélectionner avatarPublicId dans un findById dédié avant update.
if (newAvatarPublicId && user.avatarPublicId) {
  await uploader.deleteByPublicId(user.avatarPublicId).catch(() => {});
}

      return updated;
    } catch (error) {
      if (newAvatarPublicId) {
        await uploader.deleteByPublicId(newAvatarPublicId).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Supprimer mon compte ────────────────────────────────────
  // user.service.js — deleteAccount()
  async deleteAccount(userId) {
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("Utilisateur");

    // Bloquer si l'user a des events actifs
    const activeEvents = await userRepo.countActiveEvents(userId);
    if (activeEvents > 0) {
      throw new BadRequestError(
        "Impossible de supprimer votre compte : vous avez des événements publiés ou en cours. Clôturez-les d'abord.",
      );
    }

    if (user.avatarUrl) {
      const uploader = new MediaUploader();
      await uploader.deleteByUrl(user.avatarUrl).catch(() => {});
    }

    await userRepo.deleteUser(userId);
    return { success: true };
  }

  // ─── Mettre à jour le Push Token (Expo) ─────────────────────
  async updatePushToken(userId, pushToken) {
    await userRepo.updatePushToken(userId, pushToken);
    return { success: true };
  }

  // ─── Mes tickets ─────────────────────────────────────────────
  async getMyTickets(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const [data, total] = await Promise.all([
      userRepo.findUserTickets(userId, { page, limit }),
      userRepo.countUserTickets(userId),
    ]);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Mes événements (Participations) ─────────────────────────
  async getMyEvents(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const [data, total] = await Promise.all([
      userRepo.findUserEvents(userId, { page, limit }),
      userRepo.countUserEvents(userId),
    ]);

    // Remapper pour renvoyer directement l'objet event (plus propre pour le front)
    const events = data.map((t) => ({ ...t.event, registeredAt: t.createdAt }));

    return {
      data: events,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Mes paiements ───────────────────────────────────────────
  async getMyPayments(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const [data, total] = await Promise.all([
      userRepo.findUserPayments(userId, { page, limit }),
      userRepo.countUserPayments(userId),
    ]);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

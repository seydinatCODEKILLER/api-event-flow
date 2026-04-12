import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class AuthRepository extends BaseRepository {
  constructor() {
    super(prisma.user);
  }

  // ─── User ─────────────────────────────────────────────────────

  findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        password: true,
        role: true,
        avatarUrl: true,
        avatarPublicId: true,
      },
    });
  }

  findByIdFull(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        moderatedEvents: {
          select: {
            assignedAt: true,
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  updateUser(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ─── Refresh tokens ───────────────────────────────────────────

  createRefreshToken(data) {
    return prisma.refreshToken.create({ data });
  }

  findRefreshToken(token) {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  revokeRefreshToken(token) {
    return prisma.refreshToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllUserTokens(userId) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  cleanupExpiredTokens() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null, lt: yesterday } },
        ],
      },
    });
  }
}

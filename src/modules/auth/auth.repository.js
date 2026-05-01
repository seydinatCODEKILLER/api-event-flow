import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class AuthRepository extends BaseRepository {
  constructor() {
    super(prisma.user);
  }

  findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        password: true,
        status: true,
        avatarUrl: true,
        avatarPublicId: true,
      },
    });
  }

  findById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        avatarUrl: true,
        avatarPublicId: true,
        pushToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findByVerificationToken(token) {
    return prisma.user.findUnique({
      where: { verificationToken: token },
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
            fullName: true,
            email: true,
            status: true,
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

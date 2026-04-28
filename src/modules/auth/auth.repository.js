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

  // ─── Participant ──────────────────────────────────────────────

  findParticipantByEmail(email) {
    return prisma.participant.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        password: true,
        status: true,
        avatarUrl: true,
      },
    });
  }

  findParticipantById(id) {
    return prisma.participant.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        tickets: {
          select: {
            id: true,
            status: true,
            qrUrl: true,
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                location: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  createParticipant(data) {
    return prisma.participant.create({ data });
  }

  updateParticipant(id, data) {
    return prisma.participant.update({ where: { id }, data });
  }

  findParticipantByActivationToken(token) {
    return prisma.participant.findUnique({
      where: { activationToken: token },
    });
  }

  // ─── Participant Refresh tokens ───────────────────────────────

  createParticipantRefreshToken(data) {
    return prisma.participantRefreshToken.create({ data });
  }

  findParticipantRefreshToken(token) {
    return prisma.participantRefreshToken.findUnique({
      where: { token },
      include: {
        participant: {
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

  revokeParticipantRefreshToken(token) {
    return prisma.participantRefreshToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllParticipantTokens(participantId) {
    return prisma.participantRefreshToken.updateMany({
      where: { participantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

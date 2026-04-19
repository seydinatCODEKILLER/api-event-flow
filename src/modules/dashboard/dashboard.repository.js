import { prisma } from "../../config/database.js";

export class DashboardRepository {
  // Compter le nombre d'événements de l'organisateur
  async countEvents(organizerId) {
    return prisma.event.count({
      where: { organizerId },
    });
  }

  // Grouper les tickets par statut pour les graphiques (Donut Chart)
  async getTicketStatusDistribution(organizerId) {
    return prisma.ticket.groupBy({
      by: ["status"],
      where: {
        event: { organizerId },
      },
      _count: {
        status: true,
      },
    });
  }

  // Récupérer les derniers scans validés (pour le tableau "Activité récente")
  async getRecentScans(organizerId, limit = 5) {
    return prisma.scanLog.findMany({
      where: {
        event: { organizerId },
        result: "VALID", // On ne montre que les entrées réussies
      },
      include: {
        ticket: {
          include: {
            participant: {
              select: { fullName: true },
            },
          },
        },
        event: {
          select: { title: true },
        },
        moderator: {
          select: { nom: true, prenom: true },
        },
      },
      orderBy: {
        scannedAt: "desc",
      },
      take: limit,
    });
  }

  // Récupérer les prochains événements à venir
  async getUpcomingEvents(organizerId, limit = 3) {
    return prisma.event.findMany({
      where: {
        organizerId,
        status: { in: ["PUBLISHED", "ONGOING"] },
        startDate: { gte: new Date() },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        location: true,
        _count: {
          select: { tickets: true, scanLogs: true },
        },
      },
      orderBy: { startDate: "asc" },
      take: limit,
    });
  }
}

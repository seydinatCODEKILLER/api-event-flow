import { DashboardRepository } from "./dashboard.repository.js";

const dashboardRepo = new DashboardRepository();

export class DashboardService {
  async getOrganizerStats(organizerId) {
    const [totalEvents, ticketDistribution, recentScans, upcomingEvents] =
      await Promise.all([
        dashboardRepo.countEvents(organizerId),
        dashboardRepo.getTicketStatusDistribution(organizerId),
        dashboardRepo.getRecentScans(organizerId, 5),
        dashboardRepo.getUpcomingEvents(organizerId, 3),
      ]);

    const ticketStats = { ACTIVE: 0, USED: 0, CANCELLED: 0 };
    let totalTickets = 0;

    ticketDistribution.forEach((item) => {
      ticketStats[item.status] = item._count.status;
      totalTickets += item._count.status;
    });

    // 2. Calculer le taux de présence (KPI principal)
    const validatedEntries = ticketStats.USED;
    const attendanceRate =
      totalTickets > 0
        ? Math.round((validatedEntries / totalTickets) * 100)
        : 0;

    // 3. Formater les derniers scans pour le tableau
    const formattedScans = recentScans.map((scan) => ({
      id: scan.id,
      participantName: scan.ticket?.participant?.fullName || "Inconnu",
      eventTitle: scan.event.title,
      moderatorName: scan.moderator
        ? `${scan.moderator.prenom} ${scan.moderator.nom}`
        : "Système",
      scannedAt: scan.scannedAt,
    }));

    return {
      kpis: {
        totalEvents,
        totalTickets,
        validatedEntries,
        attendanceRate,
      },
      chartData: {
        ticketDistribution: ticketStats,
      },
      recentActivity: formattedScans,
      upcomingEvents,
    };
  }
}

import { prisma } from "../../config/database.js";

export class FeedRepository {
  // ─── Feed principal ──────────────────────────────────────────
  async findPublishedEvents(options = {}) {
    const { cursor, limit = 20, category, city, search, isFree } = options;

    const where = {
      status: { in: ["PUBLISHED", "ONGOING"] },
      ...(category && { category }),
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(isFree !== undefined && { isFree }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const data = await prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        city: true,
        startDate: true,
        endDate: true,
        category: true,
        imageUrl: true,
        isFree: true,
        price: true,
        currency: true,
        capacity: true,
        _count: { select: { tickets: true } },
        status: true,
      },
      orderBy: { startDate: "asc" },
      take: limit + 1, // on prend 1 de plus pour savoir s'il y a une suite
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // skip le cursor lui-même
      }),
    });

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { data: items, nextCursor };
  }

  // ─── Événements à proximité (Géolocalisation Postgres) ───────
  async findNearbyEvents(latitude, longitude, radiusKm, limit) {
    const events = await prisma.$queryRaw`
    SELECT 
      id, title, location, city, 
      "startDate", "endDate", category, 
      "imageUrl", "isFree", price, currency,
      ROUND(
        (6371 * acos(
          cos(radians(${latitude})) * 
          cos(radians(latitude)) * 
          cos(radians(longitude) - radians(${longitude})) + 
          sin(radians(${latitude})) * 
          sin(radians(latitude))
        ))::numeric, 2
      ) AS distance
    FROM events
    WHERE status IN ('PUBLISHED', 'ONGOING')
      AND latitude IS NOT NULL 
      AND longitude IS NOT NULL
      AND (6371 * acos(
        cos(radians(${latitude})) * 
        cos(radians(latitude)) * 
        cos(radians(longitude) - radians(${longitude})) + 
        sin(radians(${latitude})) * 
        sin(radians(latitude))
      )) < ${radiusKm}
    ORDER BY distance ASC
    LIMIT ${limit}
  `;

    return events;
  }

  // ─── Détail d'un event public ────────────────────────────────
  async findEventDetail(eventId) {
    return prisma.event.findFirst({
      where: {
        id: eventId,
        status: { in: ["PUBLISHED", "ONGOING", "CLOSED"] },
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        city: true,
        latitude: true,
        longitude: true,
        category: true,
        startDate: true,
        endDate: true,
        capacity: true,
        status: true,
        imageUrl: true,
        isFree: true,
        price: true,
        currency: true,
        organizer: { select: { id: true, fullName: true, avatarUrl: true } },
        _count: { select: { tickets: true } },
      },
    });
  }

  // ─── Vérifications d'inscription ─────────────────────────────
  async checkRegistration(eventId, userId) {
    return prisma.ticket.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true, status: true },
    });
  }

  async getRemainingSeats(eventId, capacity) {
    const used = await prisma.ticket.count({
      where: { eventId, status: { in: ["ACTIVE", "USED"] } },
    });
    return Math.max(0, capacity - used);
  }

  // ─── Gestion du paiement (pour éviter Prisma dans le Service) ─
  async createPaymentIntent(data) {
    return prisma.payment.create({ data });
  }
}

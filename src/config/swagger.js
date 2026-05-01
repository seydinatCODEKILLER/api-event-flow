import { env } from "./env.js";

export const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "EventFlow API",
      version: "1.0.0",
      description:
        "API de gestion d'événements et contrôle d'accès offline-first pour l'Afrique",
      contact: {
        name: "Support EventFlow",
        email: "support@eventflow.com",
      },
      license: {
        name: "MIT",
        url: "https://spdx.org/licenses/MIT.html",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Serveur de développement",
      },
      {
        url: "https://api-event-flow.onrender.com",
        description: "Serveur de production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ─── Communs ───────────────────────────────────────────
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Erreur de validation" },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Opération réussie" },
            data: { type: "object" },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer", example: 150 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            totalPages: { type: "integer", example: 8 },
          },
        },

        // ─── User ──────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            fullName: { type: "string", example: "Amadou Diallo" },
            email: {
              type: "string",
              format: "email",
              example: "amadou@eventflow.com",
            },
            phone: { type: "string", nullable: true, example: "+221771234567" },
            avatarUrl: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["PENDING", "ACTIVE"],
              example: "ACTIVE",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            accessToken: { type: "string", example: "eyJhbGciOiJIUzI1..." },
            refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1..." },
          },
        },

        // ─── Event ─────────────────────────────────────────────
        Event: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Concert Youssou N'Dour" },
            description: { type: "string", nullable: true },
            location: { type: "string", example: "Dakar Arena" },
            city: { type: "string", nullable: true, example: "Dakar" },
            latitude: { type: "number", format: "float", nullable: true },
            longitude: { type: "number", format: "float", nullable: true },
            category: {
              type: "string",
              enum: [
                "CONCERT",
                "CONFERENCE",
                "SPORT",
                "FETE",
                "ART",
                "GASTRONOMIE",
                "AUTRE",
              ],
              example: "CONCERT",
            },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time", nullable: true },
            capacity: { type: "integer", example: 5000 },
            status: {
              type: "string",
              enum: ["DRAFT", "PUBLISHED", "ONGOING", "CLOSED"],
              example: "PUBLISHED",
            },
            imageUrl: { type: "string", nullable: true },
            isFree: { type: "boolean", example: true },
            price: { type: "number", nullable: true, example: 5000 },
            currency: { type: "string", example: "XOF" },
            organizerId: { type: "string", format: "uuid" },
            ticketsCount: { type: "integer", example: 3200 },
            scansCount: { type: "integer", example: 1800 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        EventFull: {
          allOf: [
            { $ref: "#/components/schemas/Event" },
            {
              type: "object",
              properties: {
                organizer: { $ref: "#/components/schemas/User" },
                moderators: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      assignedAt: { type: "string", format: "date-time" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          ],
        },

        // ─── Ticket ────────────────────────────────────────────
        TicketListItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["ACTIVE", "USED", "CANCELLED"] },
            qrPayload: { type: "string" },
            qrUrl: { type: "string", nullable: true },
            usedAt: { type: "string", format: "date-time", nullable: true },
            addedByOrganizer: { type: "boolean", example: false },
            createdAt: { type: "string", format: "date-time" },
            user: { $ref: "#/components/schemas/User" },
            emailLogs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["PENDING", "SENT", "FAILED"],
                  },
                  type: { type: "string" },
                  sentAt: {
                    type: "string",
                    format: "date-time",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        TicketDetails: {
          allOf: [
            { $ref: "#/components/schemas/TicketListItem" },
            {
              type: "object",
              properties: {
                userId: { type: "string", format: "uuid" },
                event: { $ref: "#/components/schemas/Event" },
                emailLogs: {
                  type: "array",
                  description: "Historique complet des emails",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      to: { type: "string" },
                      type: {
                        type: "string",
                        enum: ["TICKET", "TICKET_RESEND", "EMAIL_VERIFICATION"],
                      },
                      status: {
                        type: "string",
                        enum: ["PENDING", "SENT", "FAILED"],
                      },
                      error: { type: "string", nullable: true },
                      sentAt: {
                        type: "string",
                        format: "date-time",
                        nullable: true,
                      },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          ],
        },
        TicketSyncItem: {
          type: "object",
          description: "Format léger pour la synchronisation mobile offline",
          properties: {
            id: { type: "string", format: "uuid" },
            qrPayload: { type: "string" },
            qrUrl: { type: "string", nullable: true },
            status: { type: "string", enum: ["ACTIVE"] },
            userId: { type: "string", format: "uuid" },
            user: {
              type: "object",
              properties: {
                fullName: { type: "string", example: "Fatou Sow" },
              },
            },
          },
        },

        // ─── ScanLog ───────────────────────────────────────────
        ScanLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            result: {
              type: "string",
              enum: ["VALID", "ALREADY_USED", "INVALID", "CONFLICT"],
            },
            mode: { type: "string", enum: ["ONLINE", "OFFLINE"] },
            deviceId: { type: "string", example: "expo-device-abc123" },
            scannedAt: { type: "string", format: "date-time" },
            syncedAt: { type: "string", format: "date-time", nullable: true },
            ticketId: { type: "string", format: "uuid" },
            eventId: { type: "string", format: "uuid" },
            moderatorId: { type: "string", format: "uuid", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Payment ───────────────────────────────────────────
        Payment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            amount: { type: "number", example: 5000 },
            currency: { type: "string", example: "XOF" },
            status: {
              type: "string",
              enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
            },
            method: {
              type: "string",
              enum: ["ORANGE_MONEY", "WAVE", "FREE_MONEY", "CARD"],
            },
            reference: { type: "string", example: "TXN-20231024-001" },
            failureReason: { type: "string", nullable: true },
            completedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Notification ──────────────────────────────────────
        Notification: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: {
              type: "string",
              enum: [
                "INSCRIPTION_CONFIRMED",
                "EVENT_REMINDER",
                "MODERATOR_ASSIGNED",
                "TICKET_SCANNED",
                "EVENT_CANCELLED",
                "EVENT_UPDATED",
              ],
            },
            title: { type: "string", example: "Rappel d'événement" },
            body: {
              type: "string",
              example: "L'événement X commence dans 24h.",
            },
            isRead: { type: "boolean", example: false },
            metadata: { type: "object", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Sync batch (mobile → serveur) ────────────────────
        SyncPayload: {
          type: "object",
          required: ["deviceId", "scans"],
          properties: {
            deviceId: { type: "string", example: "expo-device-abc123" },
            scans: {
              type: "array",
              items: {
                type: "object",
                required: ["ticketId", "eventId", "scannedAt"],
                properties: {
                  ticketId: { type: "string", format: "uuid" },
                  eventId: { type: "string", format: "uuid" },
                  scannedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },

        // ─── Stats événement (dashboard) ──────────────────────
        EventStats: {
          type: "object",
          properties: {
            eventId: { type: "string", format: "uuid" },
            capacity: { type: "integer", example: 5000 },
            totalTickets: { type: "integer", example: 4200 },
            validatedEntries: { type: "integer", example: 3100 },
            remainingTickets: { type: "integer", example: 800 },
            attendanceRate: { type: "number", example: 73.8 },
            conflicts: { type: "integer", example: 2 },
          },
        },
      },

      // ─── Paramètres réutilisables ──────────────────────────
      parameters: {
        eventIdParam: {
          in: "path",
          name: "eventId",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID de l'événement",
        },
        ticketIdParam: {
          in: "path",
          name: "ticketId",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID du ticket",
        },
        pageQuery: {
          in: "query",
          name: "page",
          required: false,
          schema: { type: "integer", minimum: 1, default: 1 },
          description: "Numéro de page",
        },
        limitQuery: {
          in: "query",
          name: "limit",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          description: "Nombre d'éléments par page",
        },
        ticketStatusQuery: {
          in: "query",
          name: "status",
          required: false,
          schema: { type: "string", enum: ["ACTIVE", "USED", "CANCELLED"] },
          description: "Filtrer par statut du ticket",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/modules/**/*.routes.js", "./src/modules/**/*.controller.js"],
};

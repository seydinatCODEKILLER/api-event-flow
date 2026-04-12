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
        url: "https://eventflow-api.onrender.com",
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

        // ─── User (staff) ──────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", example: "a1b2c3d4-..." },
            nom: { type: "string", example: "Diallo" },
            prenom: { type: "string", example: "Amadou" },
            email: { type: "string", example: "amadou@eventflow.com" },
            role: {
              type: "string",
              enum: ["ORGANIZER", "MODERATOR"],
              example: "ORGANIZER",
            },
            avatarUrl: {
              type: "string",
              nullable: true,
              example: "https://res.cloudinary.com/...",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            accessToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
          },
        },

        // ─── Event ─────────────────────────────────────────────
        Event: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Concert Youssou N'Dour" },
            location: { type: "string", example: "Dakar Arena" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time", nullable: true },
            capacity: { type: "integer", example: 5000 },
            status: {
              type: "string",
              enum: ["DRAFT", "PUBLISHED", "ONGOING", "CLOSED"],
              example: "PUBLISHED",
            },
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
                organizer: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    nom: { type: "string", example: "Diallo" },
                    prenom: { type: "string", example: "Amadou" },
                    email: { type: "string", example: "amadou@eventflow.com" },
                    avatarUrl: { type: "string", nullable: true },
                  },
                },
                moderators: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      nom: { type: "string", example: "Ndiaye" },
                      prenom: { type: "string", example: "Moussa" },
                      email: {
                        type: "string",
                        example: "moussa@eventflow.com",
                      },
                      avatarUrl: { type: "string", nullable: true },
                      assignedAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          ],
        },

        // ─── Participant ───────────────────────────────────────
        Participant: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            fullName: { type: "string", example: "Fatou Sow" },
            email: {
              type: "string",
              nullable: true,
              example: "fatou@gmail.com",
            },
            phone: { type: "string", nullable: true, example: "+221771234567" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Ticket ────────────────────────────────────────────
        Ticket: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            qrPayload: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "USED", "CANCELLED"],
              example: "ACTIVE",
            },
            eventId: { type: "string", format: "uuid" },
            participantId: { type: "string", format: "uuid" },
            usedAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── ScanLog ───────────────────────────────────────────
        ScanLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            ticketId: { type: "string", format: "uuid" },
            eventId: { type: "string", format: "uuid" },
            moderatorId: { type: "string", format: "uuid", nullable: true },
            deviceId: { type: "string", example: "expo-device-abc123" },
            result: {
              type: "string",
              enum: ["VALID", "ALREADY_USED", "INVALID", "CONFLICT"],
              example: "VALID",
            },
            scannedAt: {
              type: "string",
              format: "date-time",
              description: "Horodatage LOCAL du scan (avant sync réseau)",
            },
            syncedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "null = pas encore synchronisé",
            },
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
          name: "id",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "ID de l'événement",
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
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/modules/**/*.routes.js", "./src/modules/**/*.controller.js"],
};

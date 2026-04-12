import { parse } from "csv-parse/sync";
import { BadRequestError } from "../errors/AppError.js";

/**
 * Parse et valide un buffer CSV de participants.
 *
 * Colonnes attendues :
 *   - fullName  (requis)
 *   - email     (optionnel)
 *   - phone     (optionnel)
 *
 * @param {Buffer} buffer - Buffer du fichier CSV (depuis multer)
 * @returns {{ valid: Array, invalid: Array }}
 */
export const parseParticipantsCsv = (buffer) => {
  // ─── Parsing ──────────────────────────────────────────────────
  let rows;
  try {
    rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // gérer le BOM UTF-8 (Excel)
    });
  } catch {
    throw new BadRequestError("Fichier CSV invalide ou mal formaté");
  }

  if (rows.length === 0) {
    throw new BadRequestError("Le fichier CSV est vide");
  }

  // ─── Validation des colonnes ──────────────────────────────────
  const firstRow = rows[0];
  if (!("fullName" in firstRow)) {
    throw new BadRequestError(
      "Colonne 'fullName' manquante — vérifiez les en-têtes du CSV",
    );
  }

  // ─── Classification valid / invalid ───────────────────────────
  const valid = [];
  const invalid = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = row.fullName?.trim();
    const email = row.email?.trim() || null;
    const phone = row.phone?.trim() || null;

    if (!fullName) {
      invalid.push({ line: i + 2, reason: "fullName manquant", raw: row });
      continue;
    }

    if (!email && !phone) {
      invalid.push({
        line: i + 2,
        reason: "email ou phone requis",
        raw: row,
      });
      continue;
    }

    valid.push({ fullName, email, phone });
  }

  return { valid, invalid, total: rows.length };
};

/**
 * Dédoublonne une liste de participants valides contre
 * les participants déjà existants en base.
 *
 * @param {Array} valid        - Participants valides issus du CSV
 * @param {Array} existingList - Participants existants (email + phone)
 * @returns {{ toCreate: Array, skipped: Array }}
 */
export const deduplicateParticipants = (valid, existingList) => {
  const existingEmails = new Set(
    existingList.map((p) => p.email).filter(Boolean),
  );
  const existingPhones = new Set(
    existingList.map((p) => p.phone).filter(Boolean),
  );

  const toCreate = [];
  const skipped = [];

  for (const participant of valid) {
    const emailExists =
      participant.email && existingEmails.has(participant.email);
    const phoneExists =
      participant.phone && existingPhones.has(participant.phone);

    if (emailExists || phoneExists) {
      skipped.push({
        fullName: participant.fullName,
        reason: emailExists ? "email déjà existant" : "téléphone déjà existant",
      });
      continue;
    }

    toCreate.push(participant);
  }

  return { toCreate, skipped };
};

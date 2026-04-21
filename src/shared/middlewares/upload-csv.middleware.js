import multer from "multer";
import path from "path";
import { BadRequestError } from "../errors/AppError.js";

const storage = multer.memoryStorage();

const csvFileFilter = (req, file, cb) => {
  if (
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel"
  ) {
    return cb(null, true);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".csv") {
    return cb(null, true);
  }

  cb(new BadRequestError("Seuls les fichiers .csv sont autorisés"), false);
};

export const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

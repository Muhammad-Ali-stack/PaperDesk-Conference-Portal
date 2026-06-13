import multer from "multer";

/*
 * Multer middleware configured with in-memory storage.
 * Uploaded files are available as req.file.buffer before being
 * forwarded to Supabase or the compliance checker.
 * Only application/* MIME types (e.g., PDF) are accepted.
 */
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("application")) {
    cb(null, true);
  } else {
    cb(new Error("Only application file types are accepted."));
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

export default upload;

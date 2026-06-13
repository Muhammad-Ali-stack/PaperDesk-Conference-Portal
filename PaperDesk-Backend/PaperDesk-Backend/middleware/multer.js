import multer from "multer";

/*
 * General-purpose Multer middleware with in-memory storage.
 * Used across routes that accept file uploads (papers, proceedings).
 */
const storage = multer.memoryStorage();
const upload = multer({ storage });

export default upload;

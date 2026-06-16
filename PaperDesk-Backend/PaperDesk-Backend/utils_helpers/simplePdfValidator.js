import { fileTypeFromBuffer } from "file-type";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * Validates a PDF buffer for format integrity and readability.
 * No application-level file size restriction is applied — the caller
 * is responsible for any storage-tier limits (e.g. Supabase bucket policy).
 *
 * Returns: { isValid: boolean, message: string, fileInfo: {...} }
 */
export const validatePdf = async (pdfBuffer, filename = "file.pdf") => {
  try {
    // Check 1: File exists and is not empty
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return {
        isValid: false,
        message: "PDF file is empty.",
        fileInfo: null,
      };
    }

    // Check 2: Verify file type
    const fileType = await fileTypeFromBuffer(pdfBuffer);

    if (!fileType || fileType.mime !== "application/pdf") {
      return {
        isValid: false,
        message: `File is not a valid PDF. Detected type: ${fileType?.mime || "unknown"}`,
        fileInfo: {
          filename,
          detectedType: fileType?.mime || "unknown",
          sizeBytes: pdfBuffer.length,
          sizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
        },
      };
    }

    // Check 3: Verify PDF readability
    let pdfData;
    try {
      pdfData = await pdfParse(pdfBuffer);
    } catch (parseError) {
      return {
        isValid: false,
        message: `PDF is corrupted or not readable: ${parseError.message}`,
        fileInfo: {
          filename,
          sizeBytes: pdfBuffer.length,
          sizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
          parseError: parseError.message,
        },
      };
    }

    // Check 4: Verify PDF has pages
    if (!pdfData || pdfData.numpages <= 0) {
      return {
        isValid: false,
        message: "PDF has no pages.",
        fileInfo: {
          filename,
          pages: 0,
          sizeBytes: pdfBuffer.length,
          sizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
        },
      };
    }

    // All checks passed
    return {
      isValid: true,
      message: "PDF is valid and ready for submission.",
      fileInfo: {
        filename,
        pages: pdfData.numpages,
        sizeBytes: pdfBuffer.length,
        sizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
        author: pdfData.info?.Author || null,
        title: pdfData.info?.Title || null,
        creationDate: pdfData.info?.CreationDate || null,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      message: `Error validating PDF: ${error.message}`,
      fileInfo: null,
    };
  }
};

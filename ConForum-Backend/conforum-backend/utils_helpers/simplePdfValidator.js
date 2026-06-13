// Use dynamic import for pdf-parse (CommonJS) or access default properly
import { fileTypeFromBuffer } from "file-type";

const MAX_PDF_SIZE_MB = 20;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

// Helper to load pdf-parse (CommonJS) in an ES module environment
let pdfParse;
const loadPdfParse = async () => {
  if (!pdfParse) {
    // When importing a CommonJS module in ESM, the default export is often the module itself
    const module = await import('pdf-parse');
    pdfParse = module.default || module;
  }
  return pdfParse;
};

/**
 * Simple PDF validator - checks file format, size, and readability
 * Returns: { isValid: boolean, message: string, fileInfo: {...} }
 */
export const validatePdf = async (pdfBuffer, filename = "file.pdf") => {
  try {
    // ---- Check 1: File size ----
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return {
        isValid: false,
        message: "PDF file is empty.",
        fileInfo: null,
      };
    }

    if (pdfBuffer.length > MAX_PDF_SIZE_BYTES) {
      return {
        isValid: false,
        message: `File size exceeds ${MAX_PDF_SIZE_MB}MB limit. Current size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB`,
        fileInfo: {
          filename,
          sizeBytes: pdfBuffer.length,
          sizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
        },
      };
    }

    // ---- Check 2: File type ----
    const fileType = await fileTypeFromBuffer(pdfBuffer);
    
    if (!fileType || fileType.mime !== "application/pdf") {
      return {
        isValid: false,
        message: "File is not a valid PDF. Detected type: " + (fileType?.mime || "unknown"),
        fileInfo: {
          filename,
          detectedType: fileType?.mime || "unknown",
          sizeBytes: pdfBuffer.length,
          sizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
        },
      };
    }

    // ---- Check 3: PDF readability (can we parse it?) ----
    const parsePdf = await loadPdfParse();
    let pdfData;
    try {
      pdfData = await parsePdf(pdfBuffer);
    } catch (parseError) {
      return {
        isValid: false,
        message: "PDF is corrupted or not readable: " + parseError.message,
        fileInfo: {
          filename,
          sizeBytes: pdfBuffer.length,
          sizeMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
          parseError: parseError.message,
        },
      };
    }

    // ---- Check 4: Has content ----
    if (!pdfData || pdfData.numpages === 0) {
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

    // ---- All checks passed ----
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
      message: "Error validating PDF: " + error.message,
      fileInfo: null,
    };
  }
};
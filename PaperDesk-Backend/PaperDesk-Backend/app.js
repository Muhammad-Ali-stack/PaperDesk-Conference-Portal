import "./config/env.js";

import express from "express";
import morgan from "morgan";
import cors from "cors";
import axios from "axios";
import FormData from "form-data";
import multer from "multer";
import authRoutes from "./routes/authRoute.js";
import authorRoute from "./routes/authorRoute.js";
import conferenceRoute from "./routes/conferenceRoute.js";
import emailRoute from "./routes/emailRoute.js";
import reviewerRoute from "./routes/reviewerRoute.js";
import organizerRoute from "./routes/organizerRoute.js";

const upload = multer({ storage: multer.memoryStorage() });

const app = express();

app.use(cors({
  origin: process.env.BASE_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "PaperDesk API is running.",
  });
});

/*
 * Public proxy route: forwards a PDF file to the Flask IEEE checker
 * and returns the compliance report..
 */
app.post("/check-compliance", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Send a PDF as multipart field named 'file'." });
    }

    const flaskUrl = process.env.IEEE_CHECKER_URL;
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "paper.pdf",
      contentType: "application/pdf",
    });

    const response = await axios.post(`${flaskUrl}/check-compliance`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      timeout: 60000,
    });

    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/author", authorRoute);
app.use("/api/conference", conferenceRoute);
app.use("/api/organizer", organizerRoute);
app.use("/api/email", emailRoute);
app.use("/api/reviewer", reviewerRoute);

app.all("/api/*", (req, res) => {
  res.status(404).json({ message: "API route not found." });
});

export default app;
import "./config/env.js";

import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import authRoutes from "./routes/authRoute.js";
import authorRoute from "./routes/authorRoute.js";
import conferenceRoute from "./routes/conferenceRoute.js";
import emailRoute from "./routes/emailRoute.js";
import reviewerRoute from "./routes/reviewerRoute.js";
import organizerRoute from "./routes/organizerRoute.js";

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
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "PaperDesk API is running.",
  });
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
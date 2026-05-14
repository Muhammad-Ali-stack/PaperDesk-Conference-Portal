import express from "express";
import { sendInvitationController } from "../controller/emailController.js";

const router = express.Router();

router.post("/invite-reviewers", sendInvitationController);

export default router;

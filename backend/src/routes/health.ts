/**
 * Trustlify Backend — Health Route
 */

import { Router } from "express";
import type { HealthCheckResponse } from "../types/api.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const response: HealthCheckResponse = {
    status: "ok",
    service: "trustlify-backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  res.json(response);
});

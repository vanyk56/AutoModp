import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    env: {
      OPENROUTER_API_KEY_exists: !!process.env.OPENROUTER_API_KEY,
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash (default)",
      NODE_ENV: process.env.NODE_ENV || "not set",
    }
  });
});

export default router;

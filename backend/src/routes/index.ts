import { Router } from "express";
import { uploadMiddleware } from "../middleware/validateUpload";
import { uploadController } from "../controllers/uploadController";
import { processController } from "../controllers/processController";

const router = Router();

/**
 * POST /api/upload
 * Accepts a CSV file upload, parses it, stores a session, returns preview data.
 * Body: multipart/form-data with field "file"
 */
router.post("/upload", uploadMiddleware, uploadController);

/**
 * POST /api/process
 * Triggers AI batch processing for a previously uploaded CSV session.
 * Body: { sessionId: string }
 */
router.post("/process", processController);

/**
 * GET /api/health
 * Health check endpoint for Docker and load balancers.
 */
router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "AI CSV Importer API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;

import express from "express";
import { requireDebugAuth } from "../../middleware/requireDebugAuth.js";
import {
  getLogs,
  getAgendaLogs,
  getAgendaJobs,
  enableAgendaJob,
  disableAgendaJob,
  runAgendaJob,
  setGraphDelegatedToken,
  startGraphAuth,
  graphAuthCallback,
} from "./debugController.js";

const router = express.Router();

// Apply debug auth to all routes
router.use(requireDebugAuth);

// Server logs
router.get("/logs", getLogs);

// Scheduler-related debug routes
router.get("/agenda/logs", getAgendaLogs);
router.get("/agenda/jobs", getAgendaJobs);
router.post("/agenda/enable", enableAgendaJob);
router.post("/agenda/disable", disableAgendaJob);
router.post("/agenda/run", runAgendaJob);

// Graph-related debug routes
router.post("/graph/delegated-token", setGraphDelegatedToken);
router.get("/graph/start", startGraphAuth);
router.get("/graph/callback", graphAuthCallback);

export default router;

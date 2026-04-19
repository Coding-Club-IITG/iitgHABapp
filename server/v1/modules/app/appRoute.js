import express from "express";

import { authenticateJWT } from "../../middleware/authenticateJWT.js";
import { getAppBootstrap } from "./appController.js";

const appRouter = express.Router();

appRouter.get("/bootstrap", authenticateJWT, getAppBootstrap);

export default appRouter;

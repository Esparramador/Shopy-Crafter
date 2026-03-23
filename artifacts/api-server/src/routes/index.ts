import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import projectsRouter from "./projects.js";
import productsRouter from "./products.js";
import redesignRouter from "./redesign.js";
import imagesRouter from "./images.js";
import pricingRouter from "./pricing.js";
import seoRouter from "./seo.js";
import abTestingRouter from "./ab-testing.js";
import jobsRouter from "./jobs.js";
import consistencyRouter from "./consistency.js";
import authRouter from "./auth.js";
import adminRouter from "./admin.js";
import clientRouter from "./client.js";
import cmsRouter from "./cms.js";
import { requireAuth, requireAdmin } from "../lib/auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/client", clientRouter);
router.use("/cms/content", (req, res, next) => {
  if (req.method === "GET") return next();
  return requireAdmin(req, res, next);
});
router.use("/cms", cmsRouter);

router.use(requireAuth);
router.use(projectsRouter);
router.use(productsRouter);
router.use(redesignRouter);
router.use(imagesRouter);
router.use(pricingRouter);
router.use(seoRouter);
router.use(abTestingRouter);
router.use(jobsRouter);
router.use(consistencyRouter);

export default router;

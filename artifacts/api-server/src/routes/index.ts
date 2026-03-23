import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import productsRouter from "./products";
import redesignRouter from "./redesign";
import imagesRouter from "./images";
import pricingRouter from "./pricing";
import seoRouter from "./seo";
import abTestingRouter from "./ab-testing";
import jobsRouter from "./jobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(productsRouter);
router.use(redesignRouter);
router.use(imagesRouter);
router.use(pricingRouter);
router.use(seoRouter);
router.use(abTestingRouter);
router.use(jobsRouter);

export default router;

import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import env from "../config/env.js";
import openapi, { routesIndex } from "../docs/openapi.js";
import { ok } from "../utils/ApiResponse.js";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import categoryRoutes from "./category.routes.js";
import productRoutes from "./product.routes.js";
import tagRoutes from "./tag.routes.js";
import orderRoutes from "./order.routes.js";
import { commentRouter, productCommentRouter } from "./comment.routes.js";

const prefix = env.apiPrefix;

const router = Router();

const swaggerDocument = {
  ...openapi,
  servers: [{ url: prefix, description: "Versioned API base path" }],
};

const swaggerOptions = {
  customSiteTitle: "Backend Starter Kit API - Express",
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: "list",
    deepLinking: true,
  },
};

// swagger-ui-express emits relative asset URLs ("./swagger-ui.css"). Rewriting them to
// absolute paths lets the UI be served from /api/v1/docs without a trailing slash.
const swaggerHtml = swaggerUi
  .generateHTML(swaggerDocument, swaggerOptions)
  .replaceAll("./", `${prefix}/docs/`);

router.get("/", (req, res) =>
  ok(res, "API index retrieved", {
    ...routesIndex,
    prefix: env.apiPrefix,
    base_url: env.apiBaseUrl,
  }),
);

router.get("/docs.json", (req, res) => {
  res.status(200).json(swaggerDocument);
});

function sendSwagger(_req, res) {
  res.status(200).type("html").send(swaggerHtml);
}

router.get("/docs", sendSwagger);
// The stock Swagger file points at petstore.swagger.io. Serve the local UI instead.
router.get("/docs/index.html", sendSwagger);

router.use("/docs", ...swaggerUi.serve);

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/tags", tagRoutes);
router.use("/orders", orderRoutes);
router.use("/comments", commentRouter);
router.use("/", productCommentRouter);

export default router;

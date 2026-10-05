import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { getRouter } from "./router";
import "./styles.css";

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app mount element");

createRoot(app).render(
  <StrictMode>
    <RouterProvider router={getRouter()} />
  </StrictMode>,
);

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import EnvoisNominatifsPage from "../../../src/pages/admin/EnvoisNominatifsPage";
import "./style.css";

// Local component fixture, never referenced by production routes or auth.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter><div className="min-h-screen bg-gray-50 p-3 sm:p-8"><EnvoisNominatifsPage /></div></BrowserRouter></React.StrictMode>
);

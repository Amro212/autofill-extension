import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Job Copilot",
    description: "AI copilot for job applications",
    permissions: ["storage"],
    host_permissions: ["http://127.0.0.1/*", "http://localhost/*"],
    browser_specific_settings: {
      gecko: {
        id: "job-copilot@autofill-ext.local",
        data_collection_permissions: {
          required: [
            "personallyIdentifyingInfo",
            "healthInfo",
            "financialAndPaymentInfo",
            "personalCommunications",
            "locationInfo",
            "browsingActivity",
            "websiteContent",
            "websiteActivity",
          ],
        },
      },
    },
  },
});

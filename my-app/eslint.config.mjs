import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // `createTaskForActor` takes the actor as an argument, so it must only be reached from
    // code that has already established who the actor is. UI and page code always has a
    // session — it should go through `createTaskAction`, which derives the actor from it.
    // The narrow exceptions (below) are the server entry points that verify an actor
    // by other means: the Server Action wrapper and the inbound-email cron.
    files: ["src/app/**", "src/components/**"],
    ignores: ["src/app/api/cron/inbound-email/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/modules/task/server/create-task-core",
              message:
                "Use createTaskAction from @/modules/task/server/actions/create-task — it derives the actor from the session. createTaskForActor takes an actor argument and is only for callers with no request context (e.g. the inbound-email cron).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;

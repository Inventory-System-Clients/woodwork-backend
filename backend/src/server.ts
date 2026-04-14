import { app } from "./app";
import { env } from "./config/env";
import { startBudgetLifecycleJob } from "./jobs/budget-lifecycle.job";

app.listen(env.PORT, () => {
  console.log(`Backend running on port ${env.PORT}`);
  startBudgetLifecycleJob();
});
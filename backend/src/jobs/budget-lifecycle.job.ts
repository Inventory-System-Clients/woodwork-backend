import { budgetRepository } from "../repositories/budget.repository";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

export function startBudgetLifecycleJob(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  const run = async () => {
    try {
      const result = await budgetRepository.runLifecycleMaintenance();
      if (result.autoRejectedCount > 0 || result.deletedCount > 0) {
        console.info("[budget-lifecycle-job] maintenance applied", result);
      }
    } catch (error) {
      console.error("[budget-lifecycle-job] maintenance failed", error);
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, intervalMs);
}

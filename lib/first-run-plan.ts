/**
 * THE FIRST-RUN PLAN CHOICE — an organization's plan stays its first-run choice until setup starts: no tournament yet,
 * no saved setup work, onboarding not finished. Until then the plan step lets the owner change their mind freely (the
 * free-plan route switches back to Tournament without a fuss); after it, a plan change is a real move, made from
 * Subscription. Framework-free: the free-plan route and the Founding Season plan-step rule both read it, so the two can
 * never disagree about when the first choice has been made.
 */

/** The setup steps whose saved completion ends the first-run plan choice. The plan task is not one of them. */
const SETUP_TASK_IDS = ['tournament', 'divisions', 'welcome', 'venues', 'contacts'] as const;

/** Has the organization saved any setup work (`organizations.startup_tasks`)? */
export function hasSavedSetupWork(startupTasks: unknown): boolean {
  if (!startupTasks || typeof startupTasks !== 'object' || Array.isArray(startupTasks)) return false;
  const tasks = startupTasks as Record<string, { status?: unknown } | undefined>;
  return SETUP_TASK_IDS.some(taskId => tasks[taskId]?.status === 'complete');
}

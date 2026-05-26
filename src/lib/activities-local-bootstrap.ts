export type LocalBootstrapStatus = "idle" | "running" | "done" | "failed" | "auth_required";

type ShouldAttemptActivitiesLocalBootstrapInput = {
  hasLocalData: boolean;
  bootstrapStatus: LocalBootstrapStatus;
  attemptKey: string;
  attemptedKey: string | null;
};

export function shouldAttemptActivitiesLocalBootstrap(
  input: ShouldAttemptActivitiesLocalBootstrapInput,
): boolean {
  if (input.hasLocalData) {
    return false;
  }

  if (input.bootstrapStatus === "running") {
    return false;
  }

  if (input.attemptedKey === input.attemptKey) {
    return false;
  }

  return true;
}

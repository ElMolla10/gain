/** One in-flight onboarding write. Failures are shown without losing the form or navigating away. */
export function createOnboardingSaver(input: { onSaving: (saving: boolean) => void; onError: (error: unknown) => void }) {
  let busy = false;
  async function save(write: () => Promise<unknown>, done: () => void): Promise<void> {
    if (busy) return;
    busy = true;
    input.onSaving(true);
    try {
      await write();
    } catch (error) {
      busy = false;
      input.onSaving(false);
      input.onError(error);
      return;
    }
    busy = false;
    input.onSaving(false);
    done();
  }
  return { save };
}

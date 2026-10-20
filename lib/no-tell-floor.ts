/**
 * Hold a no-tell answer until at least `floorMs` after the request began. Forgot password and "Send the link again"
 * answer the same words whether or not an account exists, but the path that finds one also generates a link and sends
 * an email, so the answer's TIME told which addresses have accounts (First Look 2c review, 2026-10-20). Answering only
 * after the floor hides that for any send that finishes inside it. Sending after the answer is not an option here: the
 * serverless host drops work started after the response (no after()/waitUntil bridge on Amplify).
 */
export const NO_TELL_FLOOR_MS = 2000;

export async function holdUntilFloor(startedAt: number, floorMs: number = NO_TELL_FLOOR_MS): Promise<void> {
  const wait = startedAt + floorMs - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
}

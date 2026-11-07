/**
 * THE SETUP STEPS' WORDS — one name per step, wherever a step is shown (Club Tier Stage 13b, A2).
 * The owner's setup page (`ClubSetupKit`) and the admin's read-only "Still to do" on the Overview (`ClubStillToDo`) both read
 * this, so the same step is never called two things. The drawn words (Stage 1, specimen 10) — title, what it asks, its button.
 */
export type SetupStepKey = 'board' | 'teams' | 'coaches' | 'public' | 'budget';

export const STEP_COPY: Record<SetupStepKey, { title: string; ask: string; button: string }> = {
  board: { title: 'Staff your board', ask: 'Invite an admin and a treasurer so the work isn’t all yours.', button: 'Members' },
  teams: { title: 'Add your teams', ask: 'Each team and the season it is playing.', button: 'Rep teams' },
  coaches: { title: 'Name a head coach for every team', ask: 'Each coach gets the Premium Coaches Portal, included in your plan.', button: 'Invite a coach' },
  public: { title: 'Put your club online', ask: 'Add a tagline and a contact email to your public page.', button: 'Public site' },
  budget: { title: 'Plan the club’s budget', ask: 'What the season costs, and what each team contributes.', button: 'Budget' },
};

export type RegistrationAttentionKey =
  | 'pending_review'
  | 'waitlist'
  | 'unpaid'
  | 'past_due'
  | 'missing_intake'
  | 'unplaced'
  | 'missing_email';

export type RegistrationAttentionTone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success';

export type RegistrationPaymentStatus =
  | 'paid'
  | 'deposit-paid'
  | 'pending'
  | 'past-due'
  | 'no-schedule';

export type RegistrationAttentionAnswer = {
  fieldId: string;
  value?: string | null;
  valueText?: string | null;
  valueJson?: unknown;
  fileUrl?: string | null;
};

export type RegistrationAttentionTeam = {
  id: string;
  divisionId: string | null;
  status: string | null;
  paymentStatus?: string | null;
  depositPaid?: number | null;
  totalPaid?: number | null;
  slotId?: string | null;
  waitlistPosition?: number | null;
  customAnswers?: RegistrationAttentionAnswer[];
  email?: string | null;
};

export type RegistrationAttentionDivision = {
  id: string;
  name: string;
  depositAmount?: number | null;
  depositDueDate?: string | null;
  totalFeeAmount?: number | null;
  totalFeeDueDate?: string | null;
};

export type RegistrationAttentionField = {
  id: string;
  label: string;
  fieldType: string;
  required: boolean;
};

export type RegistrationAttentionFeeSchedule = {
  depositAmount?: number | null;
  depositDueDate?: string | null;
  totalFeeAmount?: number | null;
  totalFeeDueDate?: string | null;
};

export type RegistrationAttentionBucket = {
  key: RegistrationAttentionKey;
  label: string;
  shortLabel: string;
  count: number;
  tone: RegistrationAttentionTone;
  plusOnly?: boolean;
  description: string;
  actionLabel: string;
  divisionCounts: Array<{ divisionId: string; divisionName: string; count: number }>;
};

export type RegistrationAttentionSummary = {
  total: number;
  buckets: RegistrationAttentionBucket[];
};

export type RegistrationAttentionContext = {
  divisions: RegistrationAttentionDivision[];
  requiredFields?: RegistrationAttentionField[];
  feeMode?: 'tournament' | 'division' | string | null;
  feeSchedule?: RegistrationAttentionFeeSchedule;
  slotConfiguredDivisionIds?: Iterable<string>;
  today?: string;
};

type BucketDefinition = Omit<RegistrationAttentionBucket, 'count' | 'divisionCounts'>;

export const REGISTRATION_ATTENTION_BUCKETS: BucketDefinition[] = [
  {
    key: 'pending_review',
    label: 'Pending review',
    shortLabel: 'Review',
    tone: 'warning',
    description: 'New teams waiting for an accept, waitlist, or reject decision.',
    actionLabel: 'Review teams',
  },
  {
    key: 'waitlist',
    label: 'Waitlist',
    shortLabel: 'Waitlist',
    tone: 'primary',
    description: 'Teams queued outside the active field.',
    actionLabel: 'Open waitlist',
  },
  {
    key: 'unpaid',
    label: 'Unpaid',
    shortLabel: 'Unpaid',
    tone: 'warning',
    plusOnly: true,
    description: 'Accepted teams with a fee schedule and no completed payment yet.',
    actionLabel: 'Collect payments',
  },
  {
    key: 'past_due',
    label: 'Past due',
    shortLabel: 'Past due',
    tone: 'danger',
    plusOnly: true,
    description: 'Accepted teams past a deposit or final balance deadline.',
    actionLabel: 'Send reminders',
  },
  {
    key: 'missing_intake',
    label: 'Missing intake',
    shortLabel: 'Missing',
    tone: 'danger',
    plusOnly: true,
    description: 'Teams missing required registration answers or files.',
    actionLabel: 'Complete intake',
  },
  {
    key: 'unplaced',
    // J1-066: visible on every plan (NOT plusOnly). Accepting a team into a
    // slot-configured division marks it accepted without claiming a slot; this
    // always-on list is the safety net so an accepted team can never silently
    // fall off the board on free tier. (Manual placement / promote-from-waitlist
    // stays Plus via waitlist_automation — only *visibility* of the gap is free.)
    label: 'Unplaced',
    shortLabel: 'Unplaced',
    tone: 'neutral',
    description: 'Accepted teams not assigned into configured pool or bracket slots.',
    actionLabel: 'Place teams',
  },
  {
    key: 'missing_email',
    // Not plusOnly — a missing contact email is a base-tier data-hygiene gap
    // (it blocks payment reminders, dashboard links, and Tournament Plus/League
    // chat invites alike), not a paid feature.
    label: 'Missing email',
    shortLabel: 'No email',
    tone: 'danger',
    description: 'Teams with no email on file — they can’t be reached or invited to sign up.',
    actionLabel: 'Add emails',
  },
];

const ATTENTION_KEY_SET = new Set(REGISTRATION_ATTENTION_BUCKETS.map(bucket => bucket.key));

export function isRegistrationAttentionKey(value: string | null | undefined): value is RegistrationAttentionKey {
  return Boolean(value && ATTENTION_KEY_SET.has(value as RegistrationAttentionKey));
}

export function getRegistrationAttentionBucketDefinition(key: RegistrationAttentionKey) {
  return REGISTRATION_ATTENTION_BUCKETS.find(bucket => bucket.key === key);
}

export function getRegistrationAttentionBucket(summary: RegistrationAttentionSummary, key: RegistrationAttentionKey) {
  return summary.buckets.find(bucket => bucket.key === key) ?? null;
}

export function getRegistrationAttentionFee(
  team: RegistrationAttentionTeam,
  context: Pick<RegistrationAttentionContext, 'divisions' | 'feeMode' | 'feeSchedule'>,
): RegistrationAttentionFeeSchedule {
  const division = context.divisions.find(group => group.id === team.divisionId);
  if (context.feeMode === 'division' && division?.totalFeeAmount != null) {
    return {
      depositAmount: division.depositAmount ?? null,
      depositDueDate: division.depositDueDate ?? null,
      totalFeeAmount: division.totalFeeAmount ?? null,
      totalFeeDueDate: division.totalFeeDueDate ?? null,
    };
  }
  return context.feeSchedule ?? {};
}

export function computeRegistrationAttentionPaymentStatus(
  team: RegistrationAttentionTeam,
  fee: RegistrationAttentionFeeSchedule,
  today: string,
): RegistrationPaymentStatus {
  const totalFee = Number(fee.totalFeeAmount ?? 0);
  const depositAmount = Number(fee.depositAmount ?? 0);
  const depositPaid = Number(team.depositPaid ?? 0);
  const totalPaid = Number(team.totalPaid ?? 0);

  if (!totalFee) return team.paymentStatus === 'paid' ? 'paid' : 'no-schedule';
  if (totalPaid >= totalFee) return 'paid';
  if (fee.totalFeeDueDate && today > fee.totalFeeDueDate) return 'past-due';
  if (depositAmount && fee.depositDueDate && today > fee.depositDueDate && depositPaid < depositAmount) return 'past-due';
  if (depositAmount && depositPaid >= depositAmount) return 'deposit-paid';
  return 'pending';
}

export function hasMissingRequiredRegistrationIntake(
  team: RegistrationAttentionTeam,
  requiredFields: RegistrationAttentionField[] = [],
): boolean {
  if (requiredFields.length === 0) return false;
  const answers = new Map((team.customAnswers ?? []).map(answer => [answer.fieldId, answer]));
  return requiredFields.some(field => !isRequiredFieldAnswered(field, answers.get(field.id)));
}

export function teamMatchesRegistrationAttentionKey(
  team: RegistrationAttentionTeam,
  key: RegistrationAttentionKey,
  context: RegistrationAttentionContext,
): boolean {
  const status = team.status ?? '';
  const today = context.today ?? new Date().toISOString().split('T')[0];
  const slotConfiguredDivisionIds = new Set(context.slotConfiguredDivisionIds ?? []);

  if (key === 'pending_review') return status === 'pending';
  if (key === 'waitlist') return status === 'waitlist' || team.waitlistPosition != null;

  if (key === 'missing_intake') {
    return hasMissingRequiredRegistrationIntake(team, context.requiredFields);
  }

  if (key === 'unplaced') {
    return status === 'accepted'
      && Boolean(team.divisionId && slotConfiguredDivisionIds.has(team.divisionId))
      && !team.slotId
      && team.waitlistPosition == null;
  }

  if (key === 'missing_email') {
    // Mirrors the tournament dashboard's chat-adoption "nonRejected" scope: a
    // rejected or null-status registration was never a real participant, so an
    // absent email there isn't an actionable gap.
    return team.status != null && status !== 'rejected' && !(team.email ?? '').trim();
  }

  if (status !== 'accepted') return false;

  const paymentStatus = computeRegistrationAttentionPaymentStatus(
    team,
    getRegistrationAttentionFee(team, context),
    today,
  );

  if (key === 'unpaid') return paymentStatus === 'pending';
  if (key === 'past_due') return paymentStatus === 'past-due';
  return false;
}

export function buildRegistrationAttentionSummary(
  teams: RegistrationAttentionTeam[],
  context: RegistrationAttentionContext,
): RegistrationAttentionSummary {
  const divisionMap = new Map(context.divisions.map(group => [group.id, group.name]));
  const buckets = REGISTRATION_ATTENTION_BUCKETS.map(definition => {
    const divisionCounts = new Map<string, number>();

    for (const team of teams) {
      if (!team.divisionId) continue;
      if (!teamMatchesRegistrationAttentionKey(team, definition.key, context)) continue;
      divisionCounts.set(team.divisionId, (divisionCounts.get(team.divisionId) ?? 0) + 1);
    }

    const counts = [...divisionCounts.entries()]
      .map(([divisionId, count]) => ({
        divisionId,
        divisionName: divisionMap.get(divisionId) ?? 'Unassigned division',
        count,
      }))
      .sort((a, b) => b.count - a.count || a.divisionName.localeCompare(b.divisionName));

    return {
      ...definition,
      count: counts.reduce((sum, row) => sum + row.count, 0),
      divisionCounts: counts,
    };
  });

  return {
    total: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    buckets,
  };
}

function isRequiredFieldAnswered(
  field: RegistrationAttentionField,
  answer: RegistrationAttentionAnswer | undefined,
): boolean {
  if (!answer) return false;

  if (field.fieldType === 'file') {
    return Boolean((answer.fileUrl ?? answer.value ?? answer.valueText ?? '').trim());
  }

  if (field.fieldType === 'checkbox') {
    const rawValue = answer.value ?? answer.valueText ?? '';
    if (typeof answer.valueJson === 'object' && answer.valueJson !== null && 'checked' in answer.valueJson) {
      return Boolean((answer.valueJson as { checked?: unknown }).checked);
    }
    if (typeof answer.valueJson === 'boolean') return answer.valueJson;
    return rawValue === 'true' || rawValue.toLowerCase() === 'yes';
  }

  return Boolean((answer.value ?? answer.valueText ?? '').trim());
}


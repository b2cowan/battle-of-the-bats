# Email Contact Plan

## Goal
Allow each tournament to designate a contact person whose email appears in the
"Questions? Contact..." footer of all coach-facing emails. Remove the hardcoded
`fieldlogichq@gmail.com` from email templates. Admins set this from the existing
Contacts admin page.

## DB Migration (run in Supabase SQL editor)
```sql
ALTER TABLE tournaments ADD COLUMN contact_email TEXT;
```

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Add `contactEmail?: string` to Tournament |
| `lib/db.ts` | Add `contactEmail` to `mapTournament` |
| `lib/email.ts` | `wrap()` accepts `contactEmail`; all coach-facing templates pass it through |
| `app/api/admin/tournaments/route.ts` | Add `set-contact-email` action |
| `app/[orgSlug]/admin/contacts/page.tsx` | "Use for notifications" button per row; active contact highlighted |
| `app/api/register/route.ts` | Fetch tournament `contact_email`; pass to templates |
| `app/api/registrations/[id]/route.ts` | Join age group + tournament; fix hardcoded names; pass `contact_email` |

## Behaviour
- If a tournament has a `contact_email` set, it appears in all coach email footers
- If not set, falls back to `ADMIN_EMAIL` (b2cowan@gmail.com)
- Only one contact per tournament is the notification contact at a time
- Setting a new contact replaces the previous one (stored as a plain text column)

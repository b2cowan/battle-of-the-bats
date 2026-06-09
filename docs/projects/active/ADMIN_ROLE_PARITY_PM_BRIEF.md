# PM Brief — Admin Role Parity

**One-liner:** Tournament admins (co-organizers) can now do everything an owner can *except* billing and member management — starting with the branding/Public Site page that used to block them.

## Why it matters

Owners delegate day-to-day event running to admins. But an admin clicking "Public Site" hit a wall — *"Only organization owners can manage tournament branding"* — even though branding is core event-prep work, not an ownership/billing concern. That forced the owner to do every logo/colour/public-page change personally, defeating the point of having co-organizers.

## What customers get

- **Admins can manage a tournament's Public Site**: logo, hero banner, theme/colours/font/card style, and which public pages are visible — exactly like the owner. (Advanced visual branding still needs Tournament Plus, same as before.)
- **Admins can archive completed tournaments** (the button was hidden from them, though the system already permitted it).
- **No change to the owner's exclusive powers**: billing/subscription, org-level settings, account deletion, suspending members, capability overrides, the member audit log, and ownership transfer all stay owner-only.

## Role differences after this change

| Action | Owner | Admin | Staff |
|---|---|---|---|
| Tournament branding / Public Site | ✅ | ✅ (new) | ❌ |
| Archive a completed tournament | ✅ | ✅ (new) | ❌ |
| Billing / subscription | ✅ | ❌ | ❌ |
| Org settings, account deletion | ✅ | ❌ | ❌ |
| Suspend members, capability overrides, audit log | ✅ | ❌ | ❌ |

Owners can still fine-tune any individual member up or down via per-member capability overrides — branding is now one of those toggles ("Manage tournament branding & public site").

## Also fixed (security)

Billing checkout and the Stripe portal were only hidden in the UI, not blocked on the server — a non-owner could have triggered them via a direct request. They're now enforced as owner-only on the server, matching the policy.

## Priority & success criteria

- **Priority:** High — directly unblocks the reported admin dead-end.
- **Success:** An admin can fully manage Public Site and archive completed events; owners retain sole control of billing and member management; existing owner billing flows are unaffected.

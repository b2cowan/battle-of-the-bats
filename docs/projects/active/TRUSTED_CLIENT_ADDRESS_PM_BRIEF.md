# PM Brief — One trusted visitor address for every rate limit

**What it does:** Sign-up, password reset, public forms and the Rules download each limit how often one visitor can ask. Today a person who types a made-up address into their request can get a fresh allowance every time. After this, the product uses the address its own front door saw, so the limit holds.

**Why it matters:** The limits exist to stop scripted abuse (a flood of sign-ups or reset emails). They can currently be sidestepped by anyone who knows how. A site-wide cap already protects the servers, so nothing is wide open, but the per-person limit is not doing its job. The fix is already built and proven on the feedback form; it just isn't used anywhere else.

**Who benefits:** Everyone, on every plan. Honest visitors see no change. Someone abusing the forms gets refused.

**Expected impact:** No new screens or words. The only visible effect is that a forger now gets the "try again later" refusal that honest users already see. One small risk: if the hosted site's front door doesn't send what we expect, everyone could share one allowance, so the work measures that on staging first.

**Priority:** Low. Ruled by the owner on 2026-11-18 as "not now, its own small item". Do it before sign-up and password-reset volume grows, not urgently.

**Success criteria:** On staging, ten requests with ten different made-up addresses are refused after the limit; a normal browser and a phone on another network each still get their own allowance; no legitimate visitor is locked out after release.

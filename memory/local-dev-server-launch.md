# Local Dev Server Launch

- When Codex or another AI assistant starts `npm run dev`, it must use network access/escalated permissions.
- The app performs Supabase calls during request handling through `proxy.ts`, auth helpers, and platform-admin checks. If the dev server is started in a network-restricted sandbox, it can still bind `localhost:3000` while Supabase calls fail with `EACCES`.
- After launch, verify `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200 and the server log does not show Supabase `EACCES` fetch failures.

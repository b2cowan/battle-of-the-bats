# Next.js Framework Conventions

Current app framework: Next.js 16.2.4.

Request interception:

- Use the root `proxy.ts` file and exported `proxy()` function.
- Do not add or restore a root `middleware.ts` file. The old middleware convention was migrated during the non-billing UAT remediation project.
- `proxy.ts` owns the former middleware responsibilities: Supabase session refresh, org admin and platform-admin redirects, and `x-pathname` / `x-org-slug` request headers.

Before changing framework-level behavior, read the relevant guide in `node_modules/next/dist/docs/`, especially the proxy and upgrade docs for the installed Next.js version.

# Release Manager Configuration

Used by the `/release` agent. Fill in the `FILL_IN` values below before your first release.

---

## AWS / Amplify

| Key                    | Value            | How to find it                                               |
| ---------------------- | ---------------- | ------------------------------------------------------------ |
| **Amplify app ID**     | `d3ld0l2bgmmlga` | Amplify console URL: `/apps/d1xxxxxxxxx/` — the `d1...` part |
| **AWS region**         | `ca-central-1`   | Your Amplify app region (update if different)                |
| **Master branch name** | `master`         | The branch that triggers CI/CD                               |

## CloudWatch

| Key                   | Value            | How to find it                                 |
| --------------------- | ---------------- | ---------------------------------------------- |
| **Runtime log group** | `d3ld0l2bgmmlga` | CloudWatch → Log groups → search your app name |
| **Build log group**   | `d3ld0l2bgmmlga` | Usually `/aws/amplify/[app-id]`                |

> **Note:** The email stack memory has the CloudWatch log path for email-related errors. Runtime app errors live in a separate log group — check the Amplify console → your app → Monitoring tab to find the correct group name.

---

## AWS CLI Setup (if not yet configured)

Run `/release setup` to diagnose what's missing, or set it up manually:

```powershell
aws configure
```

You'll need:

- **Access Key ID** and **Secret Access Key** — from IAM console
- **Default region** — `ca-central-1` (or wherever your Amplify app lives)
- **Output format** — `json`

**Minimum IAM permissions** (create a `fieldlogichq-deploy` IAM user with this policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:ListJobs",
        "amplify:GetJob",
        "logs:FilterLogEvents",
        "logs:GetLogEvents",
        "logs:DescribeLogGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

Verify it's working:

```powershell
aws sts get-caller-identity
aws amplify list-apps
```

---

## Amplify console quick links

```
Deployments:  https://console.aws.amazon.com/amplify/home#/apps/[APP_ID]/deployments
Build logs:   Click any build → "Build log" tab
```

---

## How the `/release` agent uses this file

The agent reads this file on every invocation to get the Amplify app ID and log group names.
Once you fill in the `FILL_IN` values, `/release fix logs` can fetch CloudWatch and Amplify
build logs automatically instead of requiring you to paste them.

Without the Amplify app ID filled in, `/release` still works for pre-flight checks and pushing —
it just can't construct the exact console URL or fetch logs programmatically.

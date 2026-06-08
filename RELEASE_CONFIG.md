# Release Manager Configuration

Used by the `/release` agent. All values below are confirmed and current.

---

## AWS / Amplify

| Key                    | Value              | Notes                                        |
| ---------------------- | ------------------ | -------------------------------------------- |
| **Amplify app ID**     | `d3ld0l2bgmmlga`   | From Amplify console URL                     |
| **AWS region**         | `us-east-2`        | Confirmed 2026-05-23 — app is in us-east-2   |
| **Dev branch**         | `dev`              | Staging environment — safe to deploy freely  |
| **Production branch**  | `master`           | Production — requires explicit confirmation  |

## CloudWatch Logs

All branches share one log group, separated by log stream prefix:

| Target      | Log group                        | Stream filter  | Console shortcut |
| ----------- | -------------------------------- | -------------- | ---------------- |
| **dev**     | `/aws/amplify/d3ld0l2bgmmlga`   | `dev`          | Amplify → Monitoring → Hosting compute logs → dev stream |
| **master**  | `/aws/amplify/d3ld0l2bgmmlga`   | `master`       | Amplify → Monitoring → Hosting compute logs → master stream |

**AWS CLI log fetch commands:**

```powershell
# Dev environment logs (last 30 min, errors only)
aws logs filter-log-events `
  --log-group-name /aws/amplify/d3ld0l2bgmmlga `
  --log-stream-name-prefix dev `
  --start-time ([DateTimeOffset]::UtcNow.AddMinutes(-30).ToUnixTimeMilliseconds()) `
  --filter-pattern "ERROR" `
  --region us-east-2

# Production logs (last 30 min, errors only)
aws logs filter-log-events `
  --log-group-name /aws/amplify/d3ld0l2bgmmlga `
  --log-stream-name-prefix master `
  --start-time ([DateTimeOffset]::UtcNow.AddMinutes(-30).ToUnixTimeMilliseconds()) `
  --filter-pattern "ERROR" `
  --region us-east-2
```

---

## Amplify Console Links

```
Dev deployments:        https://console.aws.amazon.com/amplify/home#/apps/d3ld0l2bgmmlga/deployments
Production deployments: https://console.aws.amazon.com/amplify/home#/apps/d3ld0l2bgmmlga/deployments
Compute logs:           Amplify → Monitoring → Hosting compute logs
```

---

## AWS CLI Setup (if not yet configured)

Run `/release setup` to diagnose what's missing, or set it up manually:

```powershell
aws configure
```

You'll need:
- **Access Key ID** and **Secret Access Key** — from IAM console
- **Default region** — `us-east-2`
- **Output format** — `json`

**Minimum IAM permissions** (attach to your IAM user):

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

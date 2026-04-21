# Azure prod infrastructure (Phase 19a)

Single-VM topology for the CodeTutor AI prod environment. VM runs the backend
stack via `docker compose`; Static Web Apps hosts the frontend; Key Vault
holds all runtime secrets; Log Analytics + Azure Monitor alert on VM health.

See [the roadmap plan](../../docs/) for the full Phase 19 context.

## Files

| Path | Purpose |
| --- | --- |
| `main.bicep` | Top-level template — calls the modules. |
| `main.parameters.json` | Non-secret parameter values (region, VM size, etc). |
| `modules/network.bicep` | VNet, NSG, Standard public IP (with `cloudapp.azure.com` FQDN), NIC. |
| `modules/vm.bicep` | Ubuntu 24.04 B2s + system-assigned MI + Azure Monitor Agent + DCR. |
| `modules/keyvault.bicep` | RBAC-mode KV + Secrets Officer role for bootstrap principal. |
| `modules/monitoring.bicep` | Log Analytics workspace + action group. |
| `modules/vm-health-alert.bicep` | Activity log alert on VM ResourceHealth. |
| `modules/alerts.bicep` | Scheduled-query alerts against Log Analytics — memory ≥90%, CPU ≥85%, OS disk ≥80%, syslog OOM-kill. |
| `modules/vm-kv-access.bicep` | Grants VM MI "Key Vault Secrets User" on the KV. |
| `modules/swa.bicep` | Azure Static Web App (Free), unlinked. |
| `modules/backup.bicep` | Recovery Services Vault + weekly backup policy (4-week retention). |

## One-time setup

1. **SSH key for VM admin.** Keep this separate from your personal key so it
   can be rotated without touching anything else:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/codetutor_ai_vm -C codetutor-ai-vm-admin -N ""
   ```

2. **Resource group.**
   ```bash
   az group create -n codetutor-ai-prod-rg -l eastus2
   ```

3. **Bootstrap principal.** Used to seed KV secrets post-deploy. Under normal
   use this is you (the admin running deploys):
   ```bash
   BOOTSTRAP_OID=$(az ad signed-in-user show --query id -o tsv)
   ```

## Deploy

```bash
az deployment group create \
  -g codetutor-ai-prod-rg \
  --template-file main.bicep \
  --parameters @main.parameters.json \
  --parameters \
    adminPublicKey="$(cat ~/.ssh/codetutor_ai_vm.pub)" \
    sshSourceIp="$(curl -s https://checkip.amazonaws.com)/32" \
    bootstrapPrincipalObjectId="$BOOTSTRAP_OID"
```

Idempotent — re-run whenever `main.bicep` changes. The deployment prints the
VM FQDN, public IP, KV name, and SWA hostname as outputs. Save them for 19b.

## Seed Key Vault secrets (post-deploy)

Once the deployment finishes, write the secrets the backend needs. The KV
name is in the deployment outputs:

```bash
KV=$(az deployment group show -g codetutor-ai-prod-rg -n main --query properties.outputs.keyVaultName.value -o tsv)

az keyvault secret set --vault-name "$KV" --name SUPABASE-URL               --value "..."
az keyvault secret set --vault-name "$KV" --name SUPABASE-SERVICE-ROLE-KEY --value "..."
az keyvault secret set --vault-name "$KV" --name DATABASE-URL              --value "..."
az keyvault secret set --vault-name "$KV" --name BYOK-ENCRYPTION-KEY       --value "..."
az keyvault secret set --vault-name "$KV" --name VITE-SUPABASE-URL         --value "..."
az keyvault secret set --vault-name "$KV" --name VITE-SUPABASE-ANON-KEY    --value "..."
```

Secret names use hyphens (KV disallows underscores); 19b's `refresh-env`
script maps them back to `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
etc. when writing the VM's `.env`.

## Enable VM backup (one-time, post-deploy)

The `backup.bicep` module creates the Recovery Services Vault + weekly
policy, but enrolling the VM as a protected item is a separate step —
Bicep's protected-item resource name format is finicky enough that it's
cleaner as a CLI call:

```bash
VAULT=$(az deployment group show -g codetutor-ai-prod-rg -n main --query properties.outputs.backupVaultName.value -o tsv)
POLICY=$(az deployment group show -g codetutor-ai-prod-rg -n main --query properties.outputs.backupPolicyName.value -o tsv)

az backup protection enable-for-vm \
  --resource-group codetutor-ai-prod-rg \
  --vault-name "$VAULT" \
  --vm codetutor-ai-vm \
  --policy-name "$POLICY"
```

Idempotent in the sense that re-running when protection is already enabled
fails with a clear error. To change the policy on a VM that's already
protected, use `az backup protection update-for-vm` instead.

To verify the first backup fires as expected, check after the next Sunday
02:00 UTC:
```bash
az backup job list \
  --resource-group codetutor-ai-prod-rg \
  --vault-name "$VAULT" \
  --query "[?properties.entityFriendlyName=='codetutor-ai-vm']"
```

## Tight SSH source

`sshSourceIp` is locked to your current public IP. If it changes, re-deploy
with the new CIDR — the NSG rule updates in place, no VM restart required.

## Operational hardening (Phase 20-P1)

The cloud-init + alerts module cover the "no observability past heartbeat"
and "OOM kills the box" gaps surfaced in the four-lens review:

- **2 GB swap** + `vm.swappiness=10` added at first boot. B2s has no swap
  by default, so a single memory spike went straight to the OOM killer.
- **Unattended-upgrades auto-reboot at 03:00 UTC** — kernel/security
  updates installed by `unattended-upgrades` now actually apply. See
  `/etc/apt/apt.conf.d/52unattended-upgrades-reboot` on the VM.
- **Session workspace cleanup timer** — `codetutor-session-cleanup.timer`
  runs hourly, prunes dirs under `/opt/codetutor/temp/sessions` older than
  120 minutes. Backend's startup orphan-purge handles restarts; this
  handles steady-state growth.
- **Metric alerts** (via `modules/alerts.bicep`) email the admin action
  group on sustained high memory / CPU / disk plus any OOM-killer syslog
  signal. These complement the existing VM ResourceHealth alert.

## Image pinning

The deploy workflow pushes each backend/runner build to GHCR under both
`:<github.sha>` and `:latest`. On the VM, `infra/scripts/vm-deploy-backend.sh`
pulls the specific SHA tag and retags it to `:latest` locally so compose
always runs an immutable image. Rollback pulls `${IMAGE}:${PREV_SHA}`
directly — no reliance on local cache surviving a VM rebuild.

## What this does NOT include

- **VM provisioning** (cloud-init, systemd units, Caddy compose service) —
  Phase 19b, in `infra/azure/cloud-init.yaml` + compose overrides.
- **CI/CD** — Phase 19c, in `.github/workflows/deploy.yml`.
- **SWA → repo linking** — use the portal's GitHub App flow after deploy;
  it auto-generates the deployment workflow.
- **Custom domain** — deferred; Azure-provided FQDNs cover us.

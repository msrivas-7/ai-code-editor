// Recovery Services Vault + weekly backup policy for the prod VM OS disk.
// Phase 20-P0 #2 — before this module existed, `az snapshot list` on the RG
// was empty and a VM wipe would have lost Caddy's Let's Encrypt account key
// (LE rate-limits issuance by account, so losing it means degraded TLS for
// days).
//
// Design note: this module creates the vault + policy only. Enrolling the VM
// as a protected item (`Microsoft.RecoveryServices/vaults/backupFabrics/...`)
// is notoriously brittle in Bicep — the resource name encodes RG + VM name
// into a magic string (`iaasvmcontainer;iaasvmcontainerv2;...`) and subtle
// mismatches produce cryptic "ValidateProtectableItemForBackup" errors. It's
// a one-time operation, so it lives as an `az backup protection enable-for-vm`
// post-deploy step documented in infra/azure/README.md instead.

@description('Azure region.')
param location string

@description('Tags applied to all resources.')
param tags object

@description('Vault name — must be unique within the subscription.')
param vaultName string = 'codetutor-ai-rsv'

@description('Backup policy name.')
param policyName string = 'codetutor-weekly-4wk'

@description('Weekly snapshot time in UTC, ISO-8601 with a fixed reference date. Azure ignores the date and uses the time-of-day portion.')
param scheduleTimeUtc string = '2026-01-01T02:00:00Z'

resource vault 'Microsoft.RecoveryServices/vaults@2023-04-01' = {
  name: vaultName
  location: location
  tags: tags
  sku: {
    name: 'RS0'
    tier: 'Standard'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    securitySettings: {
      softDeleteSettings: {
        softDeleteState: 'Enabled'
        softDeleteRetentionPeriodInDays: 14
      }
    }
  }
}

// Pin redundancy to LRS — cheapest tier, same-region replication. Acceptable
// for a single-VM dev-scale prod; revisit when we add a second region or
// paying users.
resource vaultConfig 'Microsoft.RecoveryServices/vaults/backupstorageconfig@2023-04-01' = {
  parent: vault
  name: 'vaultstorageconfig'
  properties: {
    storageModelType: 'LocallyRedundant'
    crossRegionRestoreFlag: false
  }
}

// V2 policy supports "instant restore" via disk snapshots held in the vault
// for 2 days — faster than blob-tier restore when we actually need it.
resource policy 'Microsoft.RecoveryServices/vaults/backupPolicies@2023-04-01' = {
  parent: vault
  name: policyName
  properties: {
    backupManagementType: 'AzureIaasVM'
    policyType: 'V2'
    instantRpRetentionRangeInDays: 2
    schedulePolicy: {
      schedulePolicyType: 'SimpleSchedulePolicyV2'
      scheduleRunFrequency: 'Weekly'
      weeklySchedule: {
        scheduleRunDays: [
          'Sunday'
        ]
        scheduleRunTimes: [
          scheduleTimeUtc
        ]
      }
    }
    retentionPolicy: {
      retentionPolicyType: 'LongTermRetentionPolicy'
      weeklySchedule: {
        daysOfTheWeek: [
          'Sunday'
        ]
        retentionTimes: [
          scheduleTimeUtc
        ]
        retentionDuration: {
          count: 4
          durationType: 'Weeks'
        }
      }
    }
    timeZone: 'UTC'
  }
}

output vaultName string = vault.name
output vaultId string = vault.id
output policyName string = policy.name
output policyId string = policy.id

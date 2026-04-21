// Beyond-heartbeat alerts (Phase 20-P1). Each rule runs against Log Analytics
// — the AMA DCR in vm.bicep forwards `Perf` (% Used Memory, % Processor Time,
// % Used Space) and `Syslog` to the workspace, so these scheduled-query
// alerts can fire without adding a separate platform-metrics destination.
// Scheduled-query alerts are ~$1.50/mo each at this cadence.

param location string
param workspaceId string
param actionGroupId string
param tags object

var actions = {
  actionGroups: [ actionGroupId ]
}

// Sustained high memory → OOM is imminent. 90% used on 4 GB leaves ~400 MB
// which is the plan's stated ceiling. 10m window + 1 failing period means a
// single one-off backup pass won't page.
resource memAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'codetutor-vm-memory-high'
  location: location
  tags: tags
  properties: {
    enabled: true
    severity: 2
    scopes: [ workspaceId ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    criteria: {
      allOf: [
        {
          query: 'Perf | where ObjectName == "Memory" and CounterName == "% Used Memory" | summarize AggregatedValue = avg(CounterValue) by bin(TimeGenerated, 5m)'
          timeAggregation: 'Average'
          metricMeasureColumn: 'AggregatedValue'
          operator: 'GreaterThan'
          threshold: 90
          failingPeriods: {
            minFailingPeriodsToAlert: 1
            numberOfEvaluationPeriods: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: actions
  }
}

// CPU-credit exhaustion on Bs-series manifests as sustained 100% throttling.
// 15m window at 85% is the plan trigger; shorter windows would false-fire on
// the first-boot docker build.
resource cpuAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'codetutor-vm-cpu-high'
  location: location
  tags: tags
  properties: {
    enabled: true
    severity: 3
    scopes: [ workspaceId ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: 'Perf | where ObjectName == "Processor" and CounterName == "% Processor Time" and InstanceName == "_Total" | summarize AggregatedValue = avg(CounterValue) by bin(TimeGenerated, 5m)'
          timeAggregation: 'Average'
          metricMeasureColumn: 'AggregatedValue'
          operator: 'GreaterThan'
          threshold: 85
          failingPeriods: {
            minFailingPeriodsToAlert: 1
            numberOfEvaluationPeriods: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: actions
  }
}

// OS disk at 80% leaves ~6 GB headroom on a 32 GB disk — enough runway to
// triage (usually stale session workspaces or journald) before compose or
// docker-pulls start failing. Single-period alert: once we cross, we want
// to know immediately.
resource diskAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'codetutor-vm-disk-high'
  location: location
  tags: tags
  properties: {
    enabled: true
    severity: 3
    scopes: [ workspaceId ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: 'Perf | where ObjectName == "Logical Disk" and CounterName == "% Used Space" and InstanceName == "_Total" | summarize AggregatedValue = avg(CounterValue) by bin(TimeGenerated, 15m)'
          timeAggregation: 'Average'
          metricMeasureColumn: 'AggregatedValue'
          operator: 'GreaterThan'
          threshold: 80
          failingPeriods: {
            minFailingPeriodsToAlert: 1
            numberOfEvaluationPeriods: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: actions
  }
}

// Kernel OOM killer fired. We route these through the mem-high alert above
// as a leading indicator, but catching the actual oom-killer syslog line is
// the confirmation that something died — higher severity because recovery
// usually needs a process restart, not just a spike passing.
resource oomAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'codetutor-vm-oom-killed'
  location: location
  tags: tags
  properties: {
    enabled: true
    severity: 1
    scopes: [ workspaceId ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    criteria: {
      allOf: [
        {
          query: 'Syslog | where SyslogMessage has_any ("Out of memory", "oom-killer", "Killed process")'
          timeAggregation: 'Count'
          operator: 'GreaterThanOrEqual'
          threshold: 1
          failingPeriods: {
            minFailingPeriodsToAlert: 1
            numberOfEvaluationPeriods: 1
          }
        }
      ]
    }
    autoMitigate: true
    actions: actions
  }
}

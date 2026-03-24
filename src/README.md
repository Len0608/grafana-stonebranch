# Stonebranch UAC

Monitor your [Stonebranch Universal Controller (UAC)](https://docs.stonebranch.com) directly in Grafana. This datasource plugin connects to the UAC built-in Prometheus metrics endpoint and ships four pre-built dashboards so you get operational visibility out of the box.

## Requirements

- Grafana 10.0.0 or newer
- Stonebranch Universal Controller with the `/resources/metrics` endpoint accessible from the Grafana server
- User configured on the Universal Controller with either the ops.admin or ops.service role.

## Features

- **No Prometheus server required** — queries the UAC metrics endpoint directly
- **Supports Basic auth and Personal Access Tokens (PAT)**
- **Four pre-built dashboards** included:
  - **UAC Overview** — active task instances by status, agent health, OMS server status
  - **UAC Task Execution** — lifetime execution history, breakdown by status and task type, top tasks table
  - **UAC License** — license consumption gauges (distributed agents, monthly executions, z/OS agents) with dynamic limits
  - **UAC JVM Health** — JVM heap, garbage collection, threads, database pool, and process stats
- **Variable support** — use `metrics` and `label_values(metric, label)` queries to build template variables
- **Label filters, value filters, and aggregations** — filter and aggregate any UAC metric directly in the query editor

## Getting Started

### 1. Add the datasource

Go to **Connections → Data sources → Add new data source** and search for **Stonebranch UAC**.

### 2. Configure the connection

| Field | Description |
|---|---|
| **URL** | Base URL of your UAC instance, e.g. `https://uac.example.com` |
| **Auth type** | `Basic` (username + password) or `PAT` (Personal Access Token) |
| **Username** | UAC username — only required for Basic auth |
| **Password / Token** | UAC password or PAT value |

Click **Save & test** to verify connectivity. A successful test reports the UAC version, number of metrics, and agent count.

## Querying

The query editor exposes the following fields:

| Field | Description |
|---|---|
| **Metric** | UAC metric name (e.g. `uc_agent_status`, `uc_task_instance_active`) |
| **Label filters** | Filter by label key/value using `=`, `!=`, `=~`, `!~` operators |
| **Value filter** | Keep only metrics matching a numeric condition (e.g. `> 0`) |
| **Aggregate** | Reduce all matching series to a single value: `sum`, `avg`, `min`, `max`, `count` |
| **Group by** | Aggregate within label groups (e.g. group by `task_instance_status`) |
| **Legend format** | Control series names using `{{label_name}}` placeholders |

## Template Variables

Use the following queries in a variable definition to build dynamic dropdowns:

```
metrics                                    # all available metric names
label_values(uc_agent_status, agent_id)   # all agent IDs
label_values(uc_history_total, task_type) # all task types seen in history
```

## Documentation

Full UAC documentation is available at [Stonebranch](https://docs.stonebranch.com).

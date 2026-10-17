# Operations Agent — Feature Documentation

## Overview
An **autonomous AI agent** that reasons over store data using the **ReAct (Reasoning + Acting)** framework. Executes multi-step Thought → Action → Observation loops using 4 restricted domain tools — no external LLM calls.

---

## Folder Structure
```
operations_agent/
├── models.py              # Pydantic schemas (request/response/trace)
├── service.py             # RetailOperationsAgent class + tools
├── router.py              # FastAPI endpoint
├── __init__.py
├── dataset/
│   └── sample_agent_tasks.json
└── README.md
```

---

## API Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/agent/run` | Run an autonomous agent task |

---

## Supported Tasks

### 1. `restock` (default)
**Goal**: Autonomous Inventory & Supplier Optimisation

**ReAct Loop Steps**:
```
Thought 1 → Inspect inventory levels to detect critical depletion
Action  1 → tool_detect_inventory_shortages(threshold=15)
Obs     1 → "Found 3 products below threshold: Atta (3 left), Salt (8 left)..."

Thought 2 → For each shortage, find cheapest historical supplier
Action  2 → tool_find_cheapest_supplier('Atta')
Obs     2 → "Best supplier: Ramesh Wholesalers @ Rs 205/unit"

Thought 3 → Calculate optimal reorder quantity
Action  3 → tool_calculate_economic_reorder(current_stock=3, target_buffer=30)
Obs     3 → "Reorder 27 units (Total: Rs 5535)"

Final     → finalize_plan_with_human_approval_boundary
```

### 2. `credit_recovery`
**Goal**: Customer Credit (Udhaar) Audit & Recovery

**ReAct Loop Steps**:
```
Thought 1 → Audit all pending credit accounts above Rs 10
Action  1 → tool_audit_customer_credit(min_amount=10.0)
Obs     1 → "3 pending accounts, total Rs 1155 outstanding"

Thought 2 → Draft payment reminder for each overdue account
Action  2 → draft_payment_reminder('Suresh Patel', amount=750.0)
Obs     2 → "Prepared localised WhatsApp reminder for BILL-055"
```

---

## Domain Tools

| Tool | Purpose |
|------|---------|
| `tool_detect_inventory_shortages` | Finds products at or below stock threshold |
| `tool_find_cheapest_supplier` | Scans historical purchases for lowest unit cost |
| `tool_calculate_economic_reorder` | Computes units to reorder to reach buffer level |
| `tool_audit_customer_credit` | Lists overdue credit accounts ranked by amount |

---

## Technique Used
**ReAct Agent Pattern** — deterministic reasoning loop:
- No external LLM calls — all logic is pure Python
- Tool-grounded: agent only takes actions via registered tools
- Human-in-the-loop: outputs `AWAITING_APPROVAL` status, never auto-executes
- Fully explainable: complete `trace` array returned with every step

---

## Output Structure
```json
{
  "goal": "Autonomous Inventory & Supplier Optimization",
  "status": "AWAITING_APPROVAL",
  "summary": "Agent detected 3 low-stock items...",
  "trace": [
    { "step": 1, "thought": "...", "action": "...", "observation": "..." }
  ],
  "proposed_actions": [
    {
      "action_type": "PURCHASE_ORDER_DRAFT",
      "product_name": "Aashirvaad Atta 5kg",
      "supplier_name": "Ramesh Wholesalers",
      "recommended_quantity": 27,
      "unit_cost": 205.0,
      "total_cost": 5535.0
    }
  ]
}
```

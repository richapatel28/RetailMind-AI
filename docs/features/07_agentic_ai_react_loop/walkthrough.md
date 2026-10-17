# Feature 07: Autonomous Retail Operations Agent (ReAct Loop)
## Step-by-Step Walkthrough, Verification & Viva Defense Guide

---

## 1. Step-by-Step Feature Walkthrough

### Step 1: Navigating to Operations Agent
1. Open the sidebar navigation and click **Operations Agent (ReAct AI)** (`/agent`).
2. Notice the top badges:
   - **"Autonomous ReAct Agent"**
   - **"Human-in-the-Loop Safe Execution Boundary Active"**

### Step 2: Selecting an Autonomous Goal
1. Select one of the two autonomous workflows:
   - **Goal 1**: *Inventory Shortage & Supplier Price Optimization*
   - **Goal 2**: *Customer Credit (Udhaar) Audit & Recovery*
2. Click **"Run Autonomous Agent"**.

### Step 3: Inspecting the ReAct Reasoning Trace
The UI renders a live step-by-step reasoning timeline:
- **Step 1**:
  - *Thought*: *"I need to inspect the current inventory levels to detect which products are critically depleted."*
  - *Action (Tool)*: `tool_detect_inventory_shortages(threshold=15)`
  - *Observation*: Identifies specific items below safety thresholds.
- **Step 2 & 3**:
  - *Thought*: *"For product 'Dettol Soap 100g' with 2 units left, I must find the historically cheapest wholesale supplier."*
  - *Action (Tool)*: `tool_find_cheapest_supplier('Dettol Soap 100g')`
  - *Observation*: Identified supplier Metro Cash & Carry at ₹28.00/unit (reorder: 28 units, total: ₹784.00).
- **Step 4**:
  - Finalizes the plan and presents structured proposal cards.

### Step 4: Human-in-the-Loop Approval & Execution
1. Each proposal is rendered as a clean card showing:
   - Product Name, Current Stock, Recommended Reorder Quantity.
   - Selected Wholesale Supplier, Unit Rate, Total Cost, Estimated Margin.
2. Click **"Approve & Execute"**:
   - Sends confirmation to `POST /api/ai/agent/approve`.
   - Atomically increments `products.current_stock` in the PostgreSQL database.
   - Logs an audit record in `inventory_movements`.
   - Card transitions to green: **"Approved & Executed"**!

---

## 2. Test Verification & Results

Verified via direct Python test script:
```
=== TESTING AUTONOMOUS AGENT REACT LOOP ===

[Goal 1: Restock & Supplier Optimization]
Status: AWAITING_APPROVAL
Summary: Agent detected 2 low-stock items. Formulated 2 wholesale replenishment orders.

Reasoning Trace:
  Step 1:
    Thought:     I need to inspect the current inventory levels to detect which products are critically depleted.
    Action:      tool_detect_inventory_shortages(threshold=15)
    Observation: Found 2 products below safety threshold: Dettol Soap 100g (2 left), Coca Cola (8 left).
  Step 2:
    Thought:     For product 'Dettol Soap 100g' with 2 units left, I must find the historically cheapest wholesale supplier.
    Action:      tool_find_cheapest_supplier('Dettol Soap 100g')
    Observation: Best supplier for 'Dettol Soap 100g' is 'Metro Cash & Carry' at Rs 28.00/unit. Recommended reorder quantity: 28 units (Total: Rs 784.00).
  Step 3:
    Thought:     For product 'Coca Cola' with 8 units left, I must find the historically cheapest wholesale supplier.
    Action:      tool_find_cheapest_supplier('Coca Cola')
    Observation: Best supplier for 'Coca Cola' is 'Metro Cash & Carry' at Rs 18.50/unit. Recommended reorder quantity: 22 units (Total: Rs 407.00).
  Step 4:
    Thought:     Evaluated 2 shortage items. Formulated 2 optimized purchase orders to prevent store stockouts while maximizing profit margins.
    Action:      finalize_plan_with_human_approval_boundary
    Observation: Ready to present 2 structured purchase order cards to the store owner for confirmation.

Proposed Actions (2):
  - Action: PURCHASE_ORDER_DRAFT | Product: Dettol Soap 100g | Supplier: Metro Cash & Carry | Qty: 28 | Rate: Rs 28.0 | Total: Rs 784.0
  - Action: PURCHASE_ORDER_DRAFT | Product: Coca Cola | Supplier: Metro Cash & Carry | Qty: 22 | Rate: Rs 18.5 | Total: Rs 407.0

=== ALL AUTONOMOUS AGENT TESTS PASSED 100%! ===
```

---

## 3. Viva / Professor Defense Q&A

**Q1. Professor: "What makes this Agentic AI rather than just a simple script or SQL query?"**
> **Answer**: A script executes rigid hardcoded logic regardless of context. An AI agent operates under the **ReAct (Reasoning + Acting)** framework: it decomposes high-level goals into sequential hypotheses (Thoughts), selectively calls specialized domain tools (Actions), interprets the tool outputs (Observations), and dynamically adjusts subsequent steps based on what it discovered. Furthermore, it explicitly enforces a **Human-in-the-Loop Confirmation Boundary** to maintain financial safety.

**Q2. Professor: "Why is the Human-in-the-Loop boundary essential?"**
> **Answer**: In autonomous retail systems, unconstrained AI actions can cause disastrous financial consequences (e.g., ordering 10,000 units by accident or triggering false supplier payments). The human approval boundary provides safety, accountability, and legal compliance while letting the AI do 99% of the tedious analytical heavy-lifting.

**Q3. Professor: "Where are the agent's actions recorded in the database?"**
> **Answer**: All autonomous agent invocations are audited in `ai_events` with `input_type = 'AGENT_REACT'`. When an action is approved, the inventory update is permanently logged in `inventory_movements` with `movement_type = 'AGENT_RESTOCK'` along with timestamp and user ID.

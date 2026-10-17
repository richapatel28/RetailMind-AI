# Feature 07: Autonomous Retail Operations Agent (ReAct Loop)
## Technical Implementation & Academic Architecture Guide

---

## 1. What is Agentic AI and the ReAct Paradigm?

Unlike standard predictive machine learning (which outputs a single label) or simple chatbots (which output conversational text), an **Agentic AI** is an autonomous software system capable of:
1. Formulating a multi-step execution plan toward an operational **Goal**.
2. Interacting with its environment through **Restricted Tools** (database lookups, inventory calculations, supplier comparisons).
3. Utilizing the **ReAct (Reasoning + Acting)** paradigm:
   $$\text{Observation}_t \rightarrow \text{Thought}_t \rightarrow \text{Action}_t \rightarrow \text{Observation}_{t+1} \rightarrow \dots \rightarrow \text{Final Proposal}$$
4. Enforcing a **Human-in-the-Loop Confirmation Boundary** before any irrevocable state changes (e.g. inventory restock, purchase commitments).

---

## 2. System Architecture & Component Interactions

```
+-----------------------------------------------------------------------------------+
|                        RetailMind Autonomous Operations Agent                     |
+-----------------------------------------------------------------------------------+
                                          |
 1. User Selects Goal                     v
+-----------------------------------------------------------------------------------+
| Express Backend Scoping (/api/ai/agent/run)                                       |
| - Retrieves live store data for req.user.id (products, purchases, credit sales)   |
| - Passes scoped context to FastAPI Agent Microservice                             |
+-----------------------------------------------------------------------------------+
                                          |
 2. Context & Goal Hand-off               v
+-----------------------------------------------------------------------------------+
| FastAPI AI Service (POST /ai/agent/run -> agent_service.py)                       |
|                                                                                   |
|  [ReAct Step 1: Inventory Depletion Audit]                                       |
|    Thought: Identify products whose stock is below safety threshold.             |
|    Action: tool_detect_inventory_shortages(threshold=15)                          |
|    Observation: Extracted low-stock items with remaining units & severity.        |
|                                                                                   |
|  [ReAct Step 2: Wholesale Supplier Rate Comparison]                               |
|    Thought: For each shortage item, scan historical invoices for cheapest rate.  |
|    Action: tool_find_cheapest_supplier(product_name)                              |
|    Observation: Identified optimal supplier, invoice reference, and unit rate.   |
|                                                                                   |
|  [ReAct Step 3: Economic Reorder Quantity Calculation]                            |
|    Thought: Calculate buffer replenishment quantity and total cost.              |
|    Action: tool_calculate_economic_reorder(current_stock, target_buffer=30)       |
|    Observation: Computed reorder quantity, total cost, and profit margin.        |
|                                                                                   |
|  [ReAct Step 4: Human-in-the-Loop Safe Execution Boundary]                       |
|    Thought: Compile proposals into actionable cards awaiting merchant approval.  |
|    Action: finalize_plan_with_human_approval_boundary                             |
|    Observation: Structured Action Cards generated.                                |
+-----------------------------------------------------------------------------------+
                                          |
 3. Returns ReAct Trace + Action Cards    v
+-----------------------------------------------------------------------------------+
| React Frontend Dashboard (/agent)                                                 |
| - Visualizes ReAct Reasoning Timeline (Thought -> Action -> Observation)          |
| - Displays Proposed Action Cards with Wholesale Supplier, Cost, and Margin        |
| - Merchant clicks "Approve & Execute" -> POST /api/ai/agent/approve               |
| - Backend updates products.current_stock & logs AGENT_RESTOCK movement            |
+-----------------------------------------------------------------------------------+
```

---

## 3. Restricted Domain Tools

The agent is restricted to read-only analytical tools during reasoning, preventing unauthorized writes:

1. **`tool_detect_inventory_shortages(products, threshold=15)`**:
   Filters store products where `current_stock <= threshold`, ranking items by criticality.
2. **`tool_find_cheapest_supplier(product_name, purchases)`**:
   Performs a historical audit of supplier invoices to extract the lowest verified unit purchase price.
3. **`tool_calculate_economic_reorder(current_stock, target_buffer=30)`**:
   Determines the optimal replenishment volume required to restore healthy store safety stock.
4. **`tool_audit_customer_credit(credit_sales, min_amount=10.0)`**:
   Analyzes pending customer credit (Udhaar) ledgers to prepare prioritized recovery reminders.

---

## 4. Human-in-the-Loop Confirmation Protocol

To ensure financial safety in real-world kirana enterprise software:
- The agent **CANNOT** commit inventory writes or issue payments directly.
- All actions are returned in status `AWAITING_APPROVAL`.
- The store owner evaluates the proposed quantities and supplier wholesale rates.
- Upon clicking **"Approve & Execute"**, the backend executes an atomic transaction that:
  1. Acquires a row lock on `products` (`FOR UPDATE`).
  2. Increments `products.current_stock`.
  3. Writes an audit entry into `inventory_movements` with `movement_type = 'AGENT_RESTOCK'`.
  4. Commits the transaction and returns the verified new stock.

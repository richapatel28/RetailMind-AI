"""
Operations Agent — Service Layer
Copied from app/services/agent_service.py — no external imports to update.
Pure Python ReAct loop with 4 deterministic domain tools.
"""

from typing import List, Dict, Any, Optional
import datetime


class RetailOperationsAgent:
    """
    Autonomous AI agent that reasons over store data using a ReAct
    (Reasoning + Acting) loop.

    Tools available:
      1. tool_detect_inventory_shortages
      2. tool_find_cheapest_supplier
      3. tool_calculate_economic_reorder
      4. tool_audit_customer_credit

    The agent never calls an external LLM — all reasoning is
    deterministic and grounded in the store data passed by the backend.
    """

    def __init__(self):
        pass

    # ============================================================
    # RESTRICTED DOMAIN TOOLS
    # ============================================================

    def tool_detect_inventory_shortages(
        self, products: List[Dict[str, Any]], threshold: int = 15
    ) -> List[Dict[str, Any]]:
        """Identifies active products where stock is at or below threshold."""
        shortages = []
        for p in products:
            current_stock = int(p.get("current_stock") or 0)
            if current_stock <= threshold:
                shortages.append({
                    "product_id": p.get("id"),
                    "name": p.get("name"),
                    "sku": p.get("sku"),
                    "current_stock": current_stock,
                    "threshold": threshold,
                    "selling_price": float(p.get("selling_price") or 0),
                    "cost_price": float(p.get("purchase_price") or 0),
                    "severity": "CRITICAL" if current_stock <= 5 else "LOW"
                })
        return sorted(shortages, key=lambda x: x["current_stock"])

    def tool_find_cheapest_supplier(
        self, product_name: str, purchases: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Scans historical supplier invoice records to identify best wholesale pricing."""
        matching_rates = []
        prod_lower = product_name.lower()

        for pur in purchases:
            supplier = pur.get("supplier_name", "Unknown Supplier")
            inv_no = pur.get("invoice_no") or f"PUR-{pur.get('id')}"
            p_date = str(pur.get("purchase_date") or "")[:10]
            items = pur.get("items", [])

            for it in items:
                it_name = (it.get("name") or it.get("product_name") or "").lower()
                if prod_lower in it_name or it_name in prod_lower:
                    rate = float(it.get("purchase_price") or it.get("cost_price") or 0)
                    if rate > 0:
                        matching_rates.append({
                            "supplier_name": supplier,
                            "invoice_no": inv_no,
                            "purchase_date": p_date,
                            "unit_cost": rate,
                            "quantity": float(it.get("quantity") or 0)
                        })

        if not matching_rates:
            return None
        return sorted(matching_rates, key=lambda x: x["unit_cost"])[0]

    def tool_calculate_economic_reorder(
        self, current_stock: int, target_buffer: int = 30
    ) -> int:
        """Calculates optimal reorder quantity to restore store buffer."""
        deficit = target_buffer - current_stock
        return max(10, deficit)

    def tool_audit_customer_credit(
        self, credit_sales: List[Dict[str, Any]], min_amount: float = 20.0
    ) -> List[Dict[str, Any]]:
        """Audits pending customer credit ledgers for collection."""
        overdue = []
        for cs in credit_sales:
            amount = float(cs.get("total_amount") or 0)
            if amount >= min_amount:
                overdue.append({
                    "sale_id": cs.get("id"),
                    "bill_number": cs.get("bill_number") or f"BILL-{cs.get('id')}",
                    "customer_name": cs.get("customer_name") or "Walk-in Customer",
                    "amount": amount,
                    "date": str(cs.get("sale_date") or cs.get("created_at") or "")[:10],
                    "status": cs.get("payment_status", "CREDIT")
                })
        return sorted(overdue, key=lambda x: x["amount"], reverse=True)

    # ============================================================
    # REACT REASONING EXECUTION
    # ============================================================

    def run_restock_optimization(self, store_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes ReAct cycle for inventory replenishment & supplier price optimization.

        Thought → Action → Observation loop:
          Step 1: Detect which products are below safety threshold
          Step 2: For each shortage, find cheapest historical supplier
          Step 3: Calculate reorder quantity and draft purchase orders
          Step 4: Synthesise final plan for human-in-the-loop approval
        """
        trace = []
        products = store_data.get("products", [])
        purchases = store_data.get("purchases", [])

        thought_1 = "I need to inspect the current inventory levels to detect which products are critically depleted."
        action_1 = "tool_detect_inventory_shortages(threshold=15)"
        shortages = self.tool_detect_inventory_shortages(products, threshold=15)
        obs_1 = (
            f"Found {len(shortages)} products below safety threshold: "
            + ", ".join([f"{s['name']} ({s['current_stock']} left)" for s in shortages[:4]])
            + ("..." if len(shortages) > 4 else "")
        )

        trace.append({"step": 1, "thought": thought_1, "action": action_1, "observation": obs_1})

        if not shortages:
            return {
                "goal": "Low Stock & Reorder Suggestions",
                "status": "COMPLETED",
                "summary": "All inventory levels are optimal. No replenishment actions required at this time.",
                "trace": trace,
                "proposed_actions": []
            }

        proposed_actions = []
        for item in shortages[:3]:
            thought_i = (
                f"For product '{item['name']}' with {item['current_stock']} units left, "
                f"I must find the historically cheapest wholesale supplier."
            )
            action_i = f"tool_find_cheapest_supplier('{item['name']}')"
            best_supplier = self.tool_find_cheapest_supplier(item["name"], purchases)
            reorder_qty = self.tool_calculate_economic_reorder(item["current_stock"], target_buffer=30)
            unit_price = best_supplier["unit_cost"] if best_supplier else item["cost_price"]
            supplier_name = best_supplier["supplier_name"] if best_supplier else "Primary Wholesaler"
            total_cost = reorder_qty * unit_price

            obs_i = (
                f"Best supplier for '{item['name']}' is '{supplier_name}' at Rs {unit_price:.2f}/unit. "
                f"Recommended reorder quantity: {reorder_qty} units (Total: Rs {total_cost:.2f})."
            )

            trace.append({
                "step": len(trace) + 1,
                "thought": thought_i,
                "action": action_i,
                "observation": obs_i
            })

            proposed_actions.append({
                "action_type": "PURCHASE_ORDER_DRAFT",
                "product_id": item["product_id"],
                "product_name": item["name"],
                "current_stock": item["current_stock"],
                "supplier_name": supplier_name,
                "recommended_quantity": reorder_qty,
                "unit_cost": unit_price,
                "total_cost": total_cost,
                "estimated_margin": round(float(item["selling_price"]) - unit_price, 2),
                "severity": item["severity"]
            })

        thought_final = (
            f"Evaluated {len(shortages)} shortage items. Formulated {len(proposed_actions)} purchase orders "
            f"to prevent store stockouts while maximising profit margins."
        )
        trace.append({
            "step": len(trace) + 1,
            "thought": thought_final,
            "action": "prepare_reorder_recommendations",
            "observation": f"Ready to present {len(proposed_actions)} purchase order suggestions for review."
        })

        return {
            "goal": "Low Stock & Reorder Suggestions",
            "status": "AWAITING_APPROVAL",
            "summary": f"Detected {len(shortages)} low-stock items. Formulated {len(proposed_actions)} wholesale replenishment orders.",
            "trace": trace,
            "proposed_actions": proposed_actions
        }

    def run_credit_recovery_audit(self, store_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes ReAct cycle for customer credit (Udhaar) audit and recovery prioritisation.

        Thought → Action → Observation loop:
          Step 1: Audit all pending customer credit accounts
          Step 2: For each high-value overdue account, draft a payment reminder
          Step 3: Return ranked recovery plan for human approval
        """
        trace = []
        credit_sales = store_data.get("credit_sales", [])

        thought_1 = "I need to audit the customer credit ledger to identify all overdue and uncollected accounts."
        action_1 = "tool_audit_customer_credit(min_amount=10.0)"
        overdue_records = self.tool_audit_customer_credit(credit_sales, min_amount=10.0)
        total_outstanding = sum(r["amount"] for r in overdue_records)
        obs_1 = (
            f"Identified {len(overdue_records)} pending customer accounts "
            f"with total uncollected balance of Rs {total_outstanding:.2f}."
        )

        trace.append({"step": 1, "thought": thought_1, "action": action_1, "observation": obs_1})

        proposed_actions = []
        for rec in overdue_records[:4]:
            thought_rec = (
                f"Customer '{rec['customer_name']}' has pending credit of Rs {rec['amount']:.2f} "
                f"under Bill #{rec['bill_number']}."
            )
            trace.append({
                "step": len(trace) + 1,
                "thought": thought_rec,
                "action": f"draft_payment_reminder('{rec['customer_name']}', amount={rec['amount']})",
                "observation": f"Prepared localised WhatsApp/SMS payment reminder draft for Bill #{rec['bill_number']}."
            })

            proposed_actions.append({
                "action_type": "CUSTOMER_PAYMENT_REMINDER",
                "sale_id": rec["sale_id"],
                "bill_number": rec["bill_number"],
                "customer_name": rec["customer_name"],
                "amount": rec["amount"],
                "date": rec["date"],
                "suggested_action": f"Send friendly payment reminder for Rs {rec['amount']:.2f}"
            })

        return {
            "goal": "Customer Credit (Udhaar) Follow-ups",
            "status": "AWAITING_APPROVAL",
            "summary": (
                f"Found {len(overdue_records)} pending credit accounts "
                f"totalling Rs {total_outstanding:.2f}."
            ),
            "trace": trace,
            "proposed_actions": proposed_actions
        }


# Singleton instance
agent_engine = RetailOperationsAgent()

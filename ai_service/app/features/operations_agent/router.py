"""
RetailMind AI — Autonomous Agent Router (ReAct Loop)
"""

from fastapi import APIRouter, HTTPException
from app.features.operations_agent.models import AgentTaskRequest, AgentTaskResponse
from app.features.operations_agent.service import agent_engine

router = APIRouter(
    prefix="/ai/agent",
    tags=["Autonomous Retail Operations Agent (ReAct)"]
)


@router.post("/run", response_model=AgentTaskResponse)
def run_agent_task(payload: AgentTaskRequest):
    """
    Execute an autonomous ReAct loop task over store records.

    Supported task types:
      - **restock** (default): Detects low-stock products, finds cheapest
        historical supplier, drafts optimised purchase orders.
      - **credit_recovery**: Audits pending customer credit (Udhaar) accounts,
        drafts WhatsApp/SMS payment reminders ranked by amount owed.

    Returns a full step-by-step reasoning trace, tool invocations,
    observations, and proposed actions for human-in-the-loop approval.
    """
    try:
        task_type = (payload.task or "restock").lower()

        if task_type == "credit_recovery":
            result = agent_engine.run_credit_recovery_audit(payload.store_data)
        else:
            result = agent_engine.run_restock_optimization(payload.store_data)

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent ReAct execution failed: {str(e)}"
        )

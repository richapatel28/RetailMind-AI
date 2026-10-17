"""
Operations Agent — Pydantic Models
Request / response schemas for the autonomous ReAct agent endpoint.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ReActStep(BaseModel):
    """One reasoning step in the ReAct (Reasoning + Acting) loop."""
    step: int
    thought: str
    action: str
    observation: str


class AgentTaskRequest(BaseModel):
    """Payload sent to the agent endpoint."""
    task: str = Field(
        default="restock",
        description="Task type: 'restock' or 'credit_recovery'"
    )
    store_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Scoped store records: products, purchases, credit_sales"
    )


class AgentTaskResponse(BaseModel):
    """Structured result returned after the ReAct loop completes."""
    goal: str
    status: str
    summary: str
    trace: List[ReActStep] = Field(default_factory=list)
    proposed_actions: List[Dict[str, Any]] = Field(default_factory=list)

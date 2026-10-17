from fastapi import FastAPI

from app.features.product_matching.router import router as product_matching_router
from app.features.payment_reconciliation.router import router as reconciliation_router
from app.features.voice_sales.router import router as voice_router
from app.features.invoice_processing.router import router as invoice_router
from app.features.store_copilot.router import router as copilot_router
from app.features.operations_agent.router import router as agent_router


app = FastAPI(
    title="RetailMind AI Service"
)


app.include_router(
    product_matching_router
)

app.include_router(
    reconciliation_router
)

app.include_router(
    voice_router
)

app.include_router(
    invoice_router
)

app.include_router(
    copilot_router
)

app.include_router(
    agent_router
)


@app.get("/")
def root():

    return {
        "message": "RetailMind AI Service is running"
    }
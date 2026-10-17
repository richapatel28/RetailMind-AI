from fastapi import APIRouter, HTTPException

from app.features.product_matching.models import ProductMatchRequest
from app.features.product_matching.service import match_product

router = APIRouter(
    prefix="/ai/product",
    tags=["Product Matching"]
)


@router.post("/match")
def product_match(request: ProductMatchRequest):
    if not request.product_name or not request.product_name.strip():
        raise HTTPException(
            status_code=400,
            detail="Product name is required"
        )

    result = match_product(request.product_name)
    return result

def validate_transaction(data):

    errors = []

    if "error" in data:
        return {
            "valid": False,
            "errors": [data["error"]]
        }

    if data.get("intent") == "unknown":
        errors.append("Transaction type could not be identified")

    if data.get("intent") in ["sale", "purchase"]:

        if not data.get("product_text"):
            errors.append("Product not identified")

        if not data.get("quantity"):
            errors.append("Quantity not identified")

    if data.get("amount") is not None:

        if data["amount"] <= 0:
            errors.append("Invalid amount")

    # Payment mode can legitimately be missing.
    # Example: "Sold 5 Maggi."
    # This is still a valid sale.

    return {
        "valid": len(errors) == 0,
        "errors": errors
    }
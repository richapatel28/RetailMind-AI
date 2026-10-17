"""
RetailMind AI - Local Multilingual RAG Service (Store Intelligence Copilot)
Retrieval-Augmented Generation running 100% locally with zero cloud LLM dependencies.
Uses 'paraphrase-multilingual-MiniLM-L12-v2' for cross-lingual semantic search
over store supplier invoices, customer credit ledgers (Udhaar), sales, and inventory.
Responses are cleanly formatted, user-friendly, and strictly localized to the requested language.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from app.features.product_matching.embedding_matcher import model

TEMPLATES = {
    "en": {
        "cheapest_supplier": "Based on verified invoice records, **{supplier}** provided the lowest purchase price for **{product}** at **₹{price:.2f}** per unit (Invoice #{invoice_no}, Date: {date}).",
        "supplier_price": "In invoice #{invoice_no} ({date}), **{supplier}** supplied **{product}** at **₹{price:.2f}** per unit (Quantity: {quantity}).",
        "customer_credit": "Customer **{customer}** currently has an outstanding credit balance of **₹{amount:.2f}** under Bill #{bill_no} dated {date}.",
        "no_credit": "There are no pending customer credit (Udhaar) records.",
        "low_stock": "The following items are running low on stock: {items}.",
        "stock_level": "According to live inventory, **{product}** has **{stock} units** available at selling price **₹{price:.2f}**.",
        "sales_summary": "Recorded sales show a total revenue of **₹{total:.2f}** across **{count}** transactions.",
        "general_answer": "{summary}",
        "not_found": "No matching store records found for '{query}'. Please check the product, invoice, or customer name.",
        "source_label": "Source Document"
    },
    "hi": {
        "cheapest_supplier": "सत्यापित इनवॉइस के अनुसार, **{supplier}** ने **{product}** के लिए सबसे कम खरीद दर **₹{price:.2f}** प्रति यूनिट दी (इनवॉइस #{invoice_no}, दिनांक: {date})।",
        "supplier_price": "इनवॉइस #{invoice_no} ({date}) में, सप्लायर **{supplier}** ने **{product}** **₹{price:.2f}** प्रति यूनिट की दर से दिया (मात्रा: {quantity})।",
        "customer_credit": "ग्राहक **{customer}** का बिल #{bill_no} (दिनांक: {date}) पर **₹{amount:.2f}** का बकाया उधार है।",
        "no_credit": "आपकी खोज से संबंधित कोई बकाया उधार रिकॉर्ड नहीं मिला।",
        "low_stock": "इन उत्पादों का स्टॉक कम है: {items}।",
        "stock_level": "लाइव इन्वेंट्री के अनुसार, **{product}** का वर्तमान स्टॉक **{stock} यूनिट** है (विक्रय मूल्य: **₹{price:.2f}**)।",
        "sales_summary": "दर्ज बिक्री के अनुसार, **{count}** लेन-देन में कुल बिक्री **₹{total:.2f}** है।",
        "general_answer": "{summary}",
        "not_found": "'{query}' के लिए कोई प्रासंगिक दुकान रिकॉर्ड या इनवॉइस नहीं मिला।",
        "source_label": "स्रोत दस्तावेज़"
    },
    "mr": {
        "cheapest_supplier": "सत्यापित इनव्हॉइसनुसार, **{supplier}** ने **{product}** साठी सर्वात कमी खरेदी दर **₹{price:.2f}** प्रति नग दिला (इनव्हॉइस #{invoice_no}, दिनांक: {date}).",
        "supplier_price": "इनव्हॉइस #{invoice_no} ({date}) मध्ये, **{supplier}** ने **{product}** **₹{price:.2f}** प्रति नग दराने पुरवला (प्रमाण: {quantity}).",
        "customer_credit": "ग्राहक **{customer}** कडे बिल #{bill_no} (दिनांक: {date}) वरील **₹{amount:.2f}** बाकी उधारी आहे.",
        "no_credit": "कोणतीही प्रलंबित उधारी नोंद आढळली नाही.",
        "low_stock": "खालील उत्पादनांचा साठा कमी आहे: {items}.",
        "stock_level": "थेट इन्व्हेंटरीनुसार, **{product}** चा उपलब्ध साठा **{stock} युनिट** आहे (विक्री दर: **₹{price:.2f}**).",
        "sales_summary": "नोंदवलेल्या विक्रीत **{count}** व्यवहारांमध्ये एकूण **₹{total:.2f}** विक्री झाली आहे.",
        "general_answer": "{summary}",
        "not_found": "'{query}' साठी कोणतीही सुसंगत दुकान नोंद किंवा इनव्हॉइस सापडले नाही.",
        "source_label": "स्रोत दस्तऐवज"
    },
    "gu": {
        "cheapest_supplier": "ચકાસાયેલ ઇનવોઇસ મુજબ, **{supplier}** એ **{product}** માટે સૌથી ઓછો ખરીદ ભાવ **₹{price:.2f}** પ્રતિ યુનિટ આપ્યો (ઇનવોઇસ #{invoice_no}, તારીખ: {date}).",
        "supplier_price": "ઇનવોઇસ #{invoice_no} ({date}) માં, સપ્લાયર **{supplier}** એ **{product}** **₹{price:.2f}** પ્રતિ યુનિટના ભાવે સપ્લાય કર્યું (જથ્થો: {quantity}).",
        "customer_credit": "ગ્રાહક **{customer}** નું બિલ #{bill_no} (તારીખ: {date}) પર **₹{amount:.2f}** બાકી ઉધાર છે.",
        "no_credit": "કોઈ બાકી ઉધાર રેકોર્ડ મળ્યો નથી.",
        "low_stock": "નીચેની વસ્તુઓનો સ્ટોક ઓછો છે: {items}.",
        "stock_level": "લાઇવ સ્ટોક મુજબ, **{product}** નો ઉપલબ્ધ સ્ટોક **{stock} યુનિટ** છે (વેચાણ ભાવ: **₹{price:.2f}**).",
        "sales_summary": "નોંધાયેલા વેચાણ મુજબ **{count}** વ્યવહારોમાં કુલ વેચાણ **₹{total:.2f}** છે.",
        "general_answer": "{summary}",
        "not_found": "'{query}' માટે કોઈ દુકાન રેકોર્ડ અથવા ઇનવોઇસ મળ્યું નથી.",
        "source_label": "સ્રોત દસ્તાવેજ"
    }
}

INDIC_CHAR_MAP = {
    'અ': 'a', 'આ': 'aa', 'ઇ': 'i', 'ઈ': 'i', 'ઉ': 'u', 'ઊ': 'u', 'એ': 'e', 'ઐ': 'ai', 'ઓ': 'o', 'ઔ': 'au',
    'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh', 'ચ': 'ch', 'છ': 'chh', 'જ': 'j', 'ઝ': 'z',
    'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh', 'ણ': 'n', 'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n',
    'પ': 'p', 'ફ': 'f', 'બ': 'b', 'ભ': 'bh', 'મ': 'm', 'ય': 'y', 'ર': 'r', 'લ': 'l', 'વ': 'v', 'શ': 'sh', 'ષ': 'sh', 'સ': 's', 'હ': 'h',
    'ા': 'a', 'િ': 'i', 'ી': 'i', 'ુ': 'u', 'ૂ': 'u', 'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au', 'ં': 'n', '્': '',
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'z',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', '्': ''
}


def indic_to_latin(text: str) -> str:
    """Converts Gujarati and Devanagari text to Latin phonetics."""
    return "".join(INDIC_CHAR_MAP.get(ch, ch) for ch in text).lower()


def consonant_skel(text: str) -> str:
    """Extracts consonant skeleton for robust cross-script name matching."""
    return "".join(ch for ch in text.lower() if ch in 'bcdfghjklmnpqrstvwxyz')


class LocalStoreRAG:
    """
    RAG engine that chunks store data, computes multilingual vector embeddings,
    and returns neatly arranged, single-language answers.
    """

    def __init__(self):
        self.encoder = model

    def build_store_chunks(self, store_data: Dict[str, Any], lang: str = "en") -> List[Dict[str, Any]]:
        chunks = []

        # 1. Supplier Invoices & Purchases
        purchases = store_data.get("purchases", [])
        for p in purchases:
            supplier_name = p.get("supplier_name", "Supplier")
            invoice_no = p.get("invoice_no") or f"PUR-{p.get('id')}"
            purchase_date = str(p.get("purchase_date", ""))[:10]
            items = p.get("items", [])

            for it in items:
                prod_name = it.get("name") or it.get("product_name", "Product")
                cost = float(it.get("unit_cost") or it.get("purchase_price") or it.get("cost_price") or it.get("price") or 0)
                qty = float(it.get("quantity") or 0)
                line_total = float(it.get("total_amount") or (cost * qty))

                if lang == "gu":
                    text = f"સપ્લાયર ઇનવોઇસ #{invoice_no}: સપ્લાયર '{supplier_name}' પાસેથી પ્રોડક્ટ '{prod_name}' ખરીદ ભાવ ₹{cost:.2f} પ્રતિ યુનિટ મળ્યો (જથ્થો: {qty}, તારીખ: {purchase_date}, કુલ: ₹{line_total:.2f})."
                elif lang == "hi":
                    text = f"सप्लायर इनवॉइस #{invoice_no}: सप्लायर '{supplier_name}' से उत्पाद '{prod_name}' खरीद दर ₹{cost:.2f} प्रति यूनिट पर मिला (मात्रा: {qty}, दिनांक: {purchase_date}, कुल: ₹{line_total:.2f})।"
                elif lang == "mr":
                    text = f"पुरवठादार इनव्हॉइस #{invoice_no}: पुरवठादार '{supplier_name}' कडून उत्पादन '{prod_name}' खरेदी दर ₹{cost:.2f} प्रति नग मिळाला (प्रमाण: {qty}, दिनांक: {purchase_date}, एकूण: ₹{line_total:.2f})."
                else:
                    text = f"Supplier Invoice #{invoice_no}: Supplier '{supplier_name}' supplied product '{prod_name}' at purchase rate of ₹{cost:.2f} per unit (Quantity: {qty}, Date: {purchase_date}, Total: ₹{line_total:.2f})."

                chunks.append({
                    "type": "SUPPLIER_INVOICE",
                    "doc_id": invoice_no,
                    "text": text,
                    "product": prod_name,
                    "supplier": supplier_name,
                    "price": cost,
                    "quantity": qty,
                    "date": purchase_date,
                    "metadata": {"invoice_no": invoice_no, "supplier": supplier_name, "product": prod_name, "rate": cost}
                })

        # 2. Customer Credit & Udhaar Ledgers
        credit_sales = store_data.get("credit_sales", [])
        seen_customers = set()
        for cs in credit_sales:
            cust_name = cs.get("customer_name") or cs.get("name") or "Walk-in Customer"
            bill_no = cs.get("bill_number") or f"BILL-{cs.get('id')}"
            amount = float(cs.get("total_amount") or 0)
            status = cs.get("payment_status", "CREDIT")
            date_str = str(cs.get("sale_date") or cs.get("created_at") or "")[:10]

            seen_customers.add(cust_name.strip().lower())

            if lang == "gu":
                text = f"ગ્રાહક ઉધાર ખાતાવહી: ગ્રાહક '{cust_name}' નું બિલ #{bill_no} પર ₹{amount:.2f} બાકી ઉધાર છે (તારીખ: {date_str}, સ્થિતિ: {status})."
            elif lang == "hi":
                text = f"ग्राहक उधार बहीखाता: ग्राहक '{cust_name}' का बिल #{bill_no} पर ₹{amount:.2f} का बकाया उधार है (दिनांक: {date_str}, स्थिति: {status})।"
            elif lang == "mr":
                text = f"ग्राहक उधारी नोंद: ग्राहक '{cust_name}' कडे बिल #{bill_no} वर ₹{amount:.2f} बाकी उधारी आहे (दिनांक: {date_str}, स्थिती: {status})."
            else:
                text = f"Customer Credit Ledger: Customer '{cust_name}' has pending credit balance of ₹{amount:.2f} under Bill #{bill_no} (Date: {date_str}, Status: {status})."

            chunks.append({
                "type": "CUSTOMER_CREDIT",
                "doc_id": bill_no,
                "text": text,
                "customer": cust_name,
                "amount": amount,
                "date": date_str,
                "metadata": {"bill_no": bill_no, "customer": cust_name, "amount": amount, "status": status}
            })

        customer_ledgers = store_data.get("customer_ledgers", [])
        for cl in customer_ledgers:
            c_name = cl.get("name", "Customer")
            if c_name.strip().lower() not in seen_customers:
                due = float(cl.get("current_due") or 0)
                if due > 0:
                    ref_id = f"LEDGER-{cl.get('id')}"
                    if lang == "gu":
                        text = f"ગ્રાહક ઉધાર ખાતાવહી: ગ્રાહક '{c_name}' નું કુલ ₹{due:.2f} બાકી ઉધાર છે."
                    elif lang == "hi":
                        text = f"ग्राहक उधार बहीखाता: ग्राहक '{c_name}' का कुल ₹{due:.2f} बकाया उधार है।"
                    elif lang == "mr":
                        text = f"ग्राहक उधारी नोंद: ग्राहक '{c_name}' कडे एकूण ₹{due:.2f} बाकी उधारी आहे."
                    else:
                        text = f"Customer Credit Ledger: Customer '{c_name}' has outstanding credit balance of ₹{due:.2f}."

                    chunks.append({
                        "type": "CUSTOMER_CREDIT",
                        "doc_id": ref_id,
                        "text": text,
                        "customer": c_name,
                        "amount": due,
                        "date": "Ledger Balance",
                        "metadata": {"bill_no": ref_id, "customer": c_name, "amount": due, "status": "CREDIT"}
                    })

        # 3. Product Catalog & Current Stock
        products = store_data.get("products", [])
        for prod in products:
            p_name = prod.get("name", "Product")
            stock = int(prod.get("current_stock") or 0)
            sp = float(prod.get("selling_price") or 0)
            cp = float(prod.get("purchase_price") or 0)
            sku = prod.get("sku", "")

            if lang == "gu":
                text = f"દુકાન સ્ટોક રેકોર્ડ: પ્રોડક્ટ '{p_name}' (SKU: {sku}) નો સ્ટોક {stock} યુનિટ છે (વેચાણ ભાવ: ₹{sp:.2f}, ખરીદ કિંમત: ₹{cp:.2f})."
            elif lang == "hi":
                text = f"दुकान स्टॉक रिकॉर्ड: उत्पाद '{p_name}' (SKU: {sku}) का स्टॉक {stock} यूनिट है (विक्रय मूल्य: ₹{sp:.2f}, खरीद दर: ₹{cp:.2f})।"
            elif lang == "mr":
                text = f"दुकान साठा नोंद: उत्पाद '{p_name}' (SKU: {sku}) चा साठा {stock} युनिट आहे (विक्री दर: ₹{sp:.2f}, खरेदी दर: ₹{cp:.2f})."
            else:
                text = f"Store Stock Record: Product '{p_name}' (SKU: {sku}) has current stock of {stock} units (Selling price: ₹{sp:.2f}, Cost price: ₹{cp:.2f})."

            chunks.append({
                "type": "INVENTORY",
                "doc_id": f"PROD-{prod.get('id')}",
                "text": text,
                "product": p_name,
                "stock": stock,
                "selling_price": sp,
                "cost_price": cp,
                "metadata": {"product": p_name, "sku": sku, "stock": stock, "selling_price": sp}
            })

        # Low Stock Alert Chunk
        low_prods = [p for p in products if int(p.get("current_stock") or 0) <= 10]
        if low_prods:
            low_names = [f"{p.get('name')} ({p.get('current_stock')} units)" for p in low_prods]
            if lang == "gu":
                text = f"ઓછો સ્ટોક ચેતવણી: નીચેની પ્રોડક્ટ્સનો સ્ટોક ઓછો છે: {', '.join(low_names)}."
            elif lang == "hi":
                text = f"कम स्टॉक सूचना: निम्नलिखित उत्पादों का स्टॉक कम है: {', '.join(low_names)}।"
            elif lang == "mr":
                text = f"कमी साठा सूचना: खालील उत्पादनांचा साठा कमी आहे: {', '.join(low_names)}."
            else:
                text = f"Low Stock Alert: The following products are running low on stock: {', '.join(low_names)}."

            chunks.append({
                "type": "INVENTORY",
                "doc_id": "LOW-STOCK-ALERT",
                "text": text,
                "product": "Low Stock Items",
                "stock": len(low_prods),
                "metadata": {"type": "LOW_STOCK_ALERT", "items": low_names}
            })

        # 4. Sales Summary Records
        recent_sales = store_data.get("recent_sales", [])
        for s in recent_sales:
            bill_no = s.get("bill_number") or f"BILL-{s.get('id')}"
            total = float(s.get("total_amount") or 0)
            profit_val = float(s.get("profit") or 0)
            cost_val = float(s.get("cost") or 0)
            source = s.get("input_source", "MANUAL")
            raw_date = str(s.get("sale_date") or s.get("created_at") or "")
            s_date = raw_date[:10]
            status = s.get("payment_status", "PAID")

            if lang == "gu":
                text = f"વેચાણ રેકોર્ડ: બિલ #{bill_no} દ્વારા તારીખ {s_date} ના રોજ કુલ વેચાણ ₹{total:.2f} (નફો: ₹{profit_val:.2f}, સ્થિતિ: {status})."
            elif lang == "hi":
                text = f"बिक्री रिकॉर्ड: बिल #{bill_no} द्वारा दिनांक {s_date} को कुल बिक्री ₹{total:.2f} (मुनाफा: ₹{profit_val:.2f}, स्थिति: {status})।"
            elif lang == "mr":
                text = f"विक्री नोंद: बिल #{bill_no} द्वारे दिनांक {s_date} रोजी एकूण विक्री ₹{total:.2f} (नफा: ₹{profit_val:.2f}, स्थिती: {status})."
            else:
                text = f"Sales Record: Bill #{bill_no} on date {s_date} has total sales ₹{total:.2f} (profit: ₹{profit_val:.2f}, status: {status})."

            chunks.append({
                "type": "SALE_RECORD",
                "doc_id": bill_no,
                "text": text,
                "amount": total,
                "profit": profit_val,
                "cost": cost_val,
                "source": source,
                "date": s_date,
                "metadata": {"bill_no": bill_no, "total": total, "profit": profit_val, "channel": source, "status": status}
            })

        return chunks

    def query(
        self,
        user_query: str,
        store_data: Dict[str, Any],
        language: str = "en",
        top_k: int = 10
    ) -> Dict[str, Any]:
        lang = language if language in TEMPLATES else "en"
        t = TEMPLATES[lang]

        chunks = self.build_store_chunks(store_data, lang=lang)
        if not chunks:
            return {
                "query": user_query,
                "language": lang,
                "answer": t["not_found"].format(query=user_query),
                "sources": [],
                "confidence": 0.0
            }

        query_lower = user_query.lower().strip()

        # Product name normalization dictionary (Multilingual)
        product_trans_map = {
            "મેગી": "maggi", "મેગ્ગી": "maggi", "maggi": "maggi",
            "કોકા": "coca cola", "કોલા": "coca cola", "કોક": "coca cola", "coca": "coca cola", "coke": "coca cola",
            "પાર્લે": "parle", "parle": "parle",
            "દૂધ": "milk", "milk": "milk",
            "તેલ": "oil", "oil": "oil",
            "મીઠું": "salt", "salt": "salt",
            "સાબુ": "soap", "soap": "soap",
            "સર્ફ": "surf", "surf": "surf",
            "કોલગેટ": "colgate", "colgate": "colgate",
            "આટા": "atta", "લોટ": "atta", "atta": "atta",
            "લેય્સ": "lays", "lays": "lays"
        }

        detected_product = None
        for k_term, v_name in product_trans_map.items():
            if k_term in query_lower:
                detected_product = v_name
                break

        # Check intent flags across all supported languages
        # 1. Low Stock Query Intent
        is_low_stock_query = (
            any(k in query_lower for k in [
                "low stock", "running low", "low", "shortage", "out of stock", "reorder",
                "ઓછો સ્ટોક", "સ્ટોક ઓછો", "લો સ્ટોક", "ઓછો", "ઓછું", "ઓછી", "ખૂટી",
                "कम स्टॉक", "स्टॉक कम", "कमी", "कम",
                "कमी साठा", "साठा कमी"
            ]) and any(k in query_lower for k in [
                "stock", "product", "products", "item", "items", "inventory",
                "સ્ટોક", "વસ્તુ", "વસ્તુઓ", "સામાન", "પ્રોડક્ટ", "પ્રોડક્ટ્સ", "માલ",
                "उत्पाद", "सामान", "माल", "साठा"
            ])
        ) or any(k in query_lower for k in [
            "which products are running low", "what is running low", "low stock", "out of stock",
            "કઈ વસ્તુઓનો સ્ટોક ઓછો છે", "ઓછો સ્ટોક", "સ્ટોક ઓછો",
            "किन उत्पादों का स्टॉक कम है", "कम स्टॉक",
            "कोणत्या उत्पादनांचा साठा कमी आहे", "कमी साठा"
        ])

        # 2. Profit Query Intent (Today, Weekly, Monthly, All-time)
        is_profit_query = any(k in query_lower for k in [
            "profit", "margin", "earnings", "net profit", "gain",
            "નફો", "નફા", "કમાણી", "માર્જિન", "કેટલો નફો",
            "मुनाफा", "लाभ", "कमाई", "फायदा", "कितना मुनाफा", "कितना लाभ",
            "नफा", "कमाई", "फायदा", "मार्जिन", "किती नफा"
        ])

        # 3. Sales Summary Query Intent (when not asking specifically about profit)
        is_sales_query = not is_profit_query and any(k in query_lower for k in [
            "how were my sales today", "today's sale", "today sales", "today's sales", "sales today",
            "my sales", "total sale", "total sales", "revenue today", "total revenue",
            "આજે મારું વેચાણ કેટલું થયું", "આજનું વેચાણ", "આજની આવક", "વેચાણ કેટલું", "કુલ વેચાણ",
            "आज मेरी कुल बिक्री कैसी रही", "आज की बिक्री", "कुल बिक्री", "कितनी बिक्री",
            "आज माझी एकूण विक्री कशी झाली", "आजची विक्री", "एकूण विक्री"
        ])

        # 3. Recent Supplier Purchases Query Intent
        is_recent_purchases_query = any(k in query_lower for k in [
            "show recent supplier purchases", "recent supplier purchases", "recent purchases", "recent invoices",
            "supplier purchases", "supplier invoices", "supplier bills", "purchase bills",
            "છેલ્લા સપ્લાયર બિલ બતાવો", "સપ્લાયર બિલ", "છેલ્લા બિલ", "ખરીદી બિલ",
            "हाल की सप्लायर खरीदारी दिखाएं", "सप्लायर खरीदारी", "सप्लायर बिल",
            "अलीकडील पुरवठादार खरेदी दाखवा", "पुरवठादार खरेदी", "पुरवठादार बिले"
        ]) and not any(k in query_lower for k in ["cheap", "cheapest", "lowest", "સસ્તું", "સસ્તી", "सस्ता", "स्वस्त"])

        # 4. Supplier Rate / Cheapest Product Query Intent
        is_supplier_rate_query = any(k in query_lower for k in [
            "cheap", "cheapest", "lowest", "supplier", "rate", "cost", "kharid", "bhav", "swast",
            "સસ્તું", "સસ્તી", "સસ્તો", "સપ્લાયર", "ભાવ", "ખરીદ", "સૌથી સસ્તી", "સૌથી સસ્તું",
            "सस्ता", "सप्लायर", "दर", "स्वस्त"
        ])

        # 5. Customer Credit / Udhaar Query Intent
        is_credit_query = any(k in query_lower for k in [
            "who has outstanding credit", "outstanding credit", "customer credit", "udhaar", "udhar",
            "pending credit", "who owes", "credit balance", "ledger balance",
            "કોનું ઉધાર ખાતું બાકી છે", "ઉધાર ખાતું", "બાકી ઉધાર", "કોનું ઉધાર", "લેણું",
            "किस ग्राहक का उधार बाकी है", "बकाया उधार", "उधार सूची",
            "कोणत्या ग्राहकाची उधारी बाकी आहे", "बाकी उधारी", "उधारी"
        ])

        # ==========================================
        # EXECUTE STRUCTURED INTENT HANDLERS
        # ==========================================

        # Intent 1: Low Stock Query
        if is_low_stock_query:
            products = store_data.get("products", [])
            low_products = [p for p in products if int(p.get("current_stock") or 0) <= 10]
            if low_products:
                col_headers = {
                    "gu": ("પ્રોડક્ટનું નામ", "હાલનો સ્ટોક", "વેચાણ ભાવ", "સ્થિતિ"),
                    "hi": ("उत्पाद का नाम", "वर्तमान स्टॉक", "विक्रय मूल्य", "स्थिति"),
                    "mr": ("उत्पादनाचे नाव", "सध्याचा साठा", "विक्री दर", "स्थिती"),
                    "en": ("Product Name", "Current Stock", "Selling Price", "Status")
                }.get(lang, ("Product Name", "Current Stock", "Selling Price", "Status"))

                intros = {
                    "gu": "**ઓછા સ્ટોકની વિગત**\nનીચેની વસ્તુઓનો સ્ટોક ઓછો છે, જેથી નવો ઓર્ડર કરવાની જરૂર છે:",
                    "hi": "**कम स्टॉक की सूचना**\nनिम्नलिखित उत्पादों का स्टॉक कम है, नया ऑर्डर करने की आवश्यकता है:",
                    "mr": "**कमी साठा तपशील**\nखालील उत्पादनांचा साठा कमी आहे, नवीन ऑर्डर करणे आवश्यक आहे:",
                    "en": "**Low Stock Items**\nThe following products are running low on stock and need to be replenished:"
                }

                status_label = {
                    "gu": "⚠️ ઓછો સ્ટોક",
                    "hi": "⚠️ कम स्टॉक",
                    "mr": "⚠️ कमी साठा",
                    "en": "⚠️ Low Stock"
                }.get(lang, "⚠️ Low Stock")

                table_lines = [
                    f"| {col_headers[0]} | {col_headers[1]} | {col_headers[2]} | {col_headers[3]} |",
                    "| :--- | :---: | :---: | :---: |"
                ]
                for p in low_products:
                    table_lines.append(f"| {p.get('name')} | **{p.get('current_stock')} units** | ₹{float(p.get('selling_price') or 0):.2f} | {status_label} |")

                answer = f"{intros.get(lang, intros['en'])}\n\n" + "\n".join(table_lines)
            else:
                answer = {
                    "gu": "તમારી દુકાનમાં બધી વસ્તુઓનો સ્ટોક પૂરતો છે (કોઈપણ પ્રોડક્ટ ઓછી નથી).",
                    "hi": "आपकी दुकान में सभी उत्पादों का स्टॉक पर्याप्त है।",
                    "mr": "आपल्या दुकानातील सर्व उत्पादनांचा साठा पुरेसा आहे.",
                    "en": "All store inventory items currently have healthy stock levels."
                }.get(lang, "All store inventory items currently have healthy stock levels.")

            inv_chunks = [c for c in chunks if c["type"] == "INVENTORY"][:top_k]
            sources = [{
                "doc_type": c["type"],
                "reference_id": c["doc_id"],
                "relevance_score": 0.95,
                "excerpt": c["text"],
                "metadata": c.get("metadata", {})
            } for c in inv_chunks]

            return {
                "query": user_query,
                "language": lang,
                "answer": answer,
                "sources": sources,
                "confidence": 0.95
            }

        # Intent 2: Sales Summary Query
        if is_sales_query:
            recent_sales = store_data.get("recent_sales", [])
            today_date = store_data.get("today_date", "")

            # Check if query is specifically asking for today's sales
            is_today_query = any(k in query_lower for k in [
                "today", "today's", "sales today", "aaj", "aaje", "આજે", "આજનું", "આજની", "आज", "आजची"
            ])

            # Compute all-time totals
            all_time_rev = sum(float(s.get("total_amount") or 0) for s in recent_sales)
            all_time_count = len(recent_sales)

            # Filter today's sales if today_sales provided, or filter by today_date / sale_date
            today_sales_list = store_data.get("today_sales")
            if today_sales_list is None:
                today_sales_list = [
                    s for s in recent_sales
                    if str(s.get("sale_date") or s.get("created_at") or "")[:10] == today_date
                ] if today_date else recent_sales

            if is_today_query:
                target_sales = today_sales_list
                total_rev = sum(float(s.get("total_amount") or 0) for s in target_sales)
                total_tx = len(target_sales)
                cash_sales = sum(float(s.get("total_amount") or 0) for s in target_sales if str(s.get("input_source") or "").upper() == "VOICE" or str(s.get("payment_status") or "").upper() == "PAID")
                credit_sales = sum(float(s.get("total_amount") or 0) for s in target_sales if str(s.get("payment_status") or "").upper() in ["CREDIT", "PENDING"])

                if total_tx == 0:
                    if lang == "gu":
                        answer = f"**આજનું વેચાણ (Today's Sales)**\n\nઆજે હજુ સુધી કોઈ નવું વેચાણ નોંધાયેલું નથી.\n\n* એકંદર નોંધાયેલ કુલ વેચાણ: **₹{all_time_rev:.2f}** ({all_time_count} બિલ)"
                    elif lang == "hi":
                        answer = f"**आज की बिक्री (Today's Sales)**\n\nआज अभी तक कोई नई बिक्री दर्ज नहीं हुई है।\n\n* अब तक की कुल बिक्री: **₹{all_time_rev:.2f}** ({all_time_count} बिल)"
                    elif lang == "mr":
                        answer = f"**आजची विक्री (Today's Sales)**\n\nआज अद्याप कोणतीही नवीन विक्री नोंदवली गेलेली नाही.\n\n* एकूण नोंदवलेली विक्री: **₹{all_time_rev:.2f}** ({all_time_count} बिले)"
                    else:
                        answer = f"**Today's Sales**\n\nNo sales recorded yet for today.\n\n* All-Time Total Recorded Sales: **₹{all_time_rev:.2f}** ({all_time_count} bills)"

                    return {
                        "query": user_query,
                        "language": lang,
                        "answer": answer,
                        "sources": [],
                        "confidence": 0.95
                    }

                if lang == "gu":
                    intro = "**આજનું વેચાણ (Today's Sales)**\nઆજે તમારી દુકાનમાં થયેલ વેચાણનો હિસાબ નીચે મુજબ છે:"
                    col_h = ("વિગત", "આજની માહિતી")
                    rows = [
                        ("આજની કુલ આવક", f"**₹{total_rev:.2f}**"),
                        ("આજના કુલ બિલ", f"**{total_tx} બિલ**"),
                        ("રોકડ વેચાણ (Cash / Paid)", f"₹{cash_sales:.2f}"),
                        ("બાકી ઉધાર વેચાણ (Credit)", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 એકંદર નોંધાયેલ વેચાણ (All-Time): **₹{all_time_rev:.2f}** ({all_time_count} કુલ બિલ)*"
                elif lang == "hi":
                    intro = "**आज की बिक्री (Today's Sales)**\nआज आपकी दुकान में हुई बिक्री का विवरण नीचे दिया गया है:"
                    col_h = ("विवरण", "आज का विवरण")
                    rows = [
                        ("आज की कुल बिक्री", f"**₹{total_rev:.2f}**"),
                        ("आज के कुल लेन-देन", f"**{total_tx} बिल**"),
                        ("नकद बिक्री (Cash / Paid)", f"₹{cash_sales:.2f}"),
                        ("उधार बिक्री (Credit)", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 अब तक की कुल बिक्री (All-Time): **₹{all_time_rev:.2f}** ({all_time_count} कुल बिल)*"
                elif lang == "mr":
                    intro = "**आजची विक्री (Today's Sales)**\nआज आपल्या दुकानात झालेल्या विक्रीचा तपशील खालीलप्रमाणे आहे:"
                    col_h = ("तपशील", "आजची माहिती")
                    rows = [
                        ("आजची एकूण विक्री", f"**₹{total_rev:.2f}**"),
                        ("आजची एकूण बिले", f"**{total_tx} बिले**"),
                        ("रोख विक्री (Cash / Paid)", f"₹{cash_sales:.2f}"),
                        ("उधारी विक्री (Credit)", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 आतापर्यंतची एकूण विक्री (All-Time): **₹{all_time_rev:.2f}** ({all_time_count} एकूण बिले)*"
                else:
                    intro = "**Today's Sales Performance**\nHere is your store's sales summary for today:"
                    col_h = ("Metric", "Today's Value")
                    rows = [
                        ("Today's Revenue", f"**₹{total_rev:.2f}**"),
                        ("Today's Bills", f"**{total_tx} bills**"),
                        ("Paid / Cash Sales", f"₹{cash_sales:.2f}"),
                        ("Credit (Udhaar) Sales", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 All-Time Recorded Sales: **₹{all_time_rev:.2f}** across {all_time_count} bills.*"

                # Filter sources strictly to today's sale chunks
                sale_chunks = [
                    c for c in chunks
                    if c["type"] == "SALE_RECORD" and (not today_date or c.get("date") == today_date)
                ][:top_k]
                if not sale_chunks:
                    # fallback to top_k sale chunks if date metadata wasn't matched
                    sale_chunks = [c for c in chunks if c["type"] == "SALE_RECORD"][:top_k]

            else:
                target_sales = recent_sales
                total_rev = all_time_rev
                total_tx = all_time_count
                cash_sales = sum(float(s.get("total_amount") or 0) for s in target_sales if str(s.get("input_source") or "").upper() == "VOICE" or str(s.get("payment_status") or "").upper() == "PAID")
                credit_sales = sum(float(s.get("total_amount") or 0) for s in target_sales if str(s.get("payment_status") or "").upper() in ["CREDIT", "PENDING"])

                today_rev = sum(float(s.get("total_amount") or 0) for s in today_sales_list)
                today_cnt = len(today_sales_list)

                if lang == "gu":
                    intro = "**એકંદર વેચાણનો હિસાબ (All-Time Sales)**\nતમારી દુકાનનું નોંધાયેલ કુલ વેચાણ નીચે મુજબ છે:"
                    col_h = ("વિગત", "રકમ / માહિતી")
                    rows = [
                        ("કુલ આવક (Total Sales)", f"**₹{total_rev:.2f}**"),
                        ("કુલ બિલ (Transactions)", f"**{total_tx} બિલ**"),
                        ("રોકડ વેચાણ (Cash / Paid)", f"₹{cash_sales:.2f}"),
                        ("બાકી ઉધાર વેચાણ (Credit)", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 આજનું વેચાણ: **₹{today_rev:.2f}** ({today_cnt} બિલ)*"
                elif lang == "hi":
                    intro = "**कुल बिक्री सारांश (All-Time Sales)**\nआपकी दुकान की दर्ज कुल बिक्री नीचे दी गई है:"
                    col_h = ("विवरण", "राशि / विवरण")
                    rows = [
                        ("कुल बिक्री (Total Sales)", f"**₹{total_rev:.2f}**"),
                        ("कुल लेन-देन (Transactions)", f"**{total_tx} बिल**"),
                        ("नकद बिक्री (Cash / Paid)", f"₹{cash_sales:.2f}"),
                        ("उधार बिक्री (Credit)", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 आज की बिक्री: **₹{today_rev:.2f}** ({today_cnt} बिल)*"
                elif lang == "mr":
                    intro = "**एकूण विक्रीचा तपशील (All-Time Sales)**\nआपल्या दुकानाची नोंदवलेली एकूण विक्री खालीलप्रमाणे आहे:"
                    col_h = ("तपशील", "रक्कम / माहिती")
                    rows = [
                        ("एकूण विक्री (Total Sales)", f"**₹{total_rev:.2f}**"),
                        ("एकूण बिले (Transactions)", f"**{total_tx} बिले**"),
                        ("रोख विक्री (Cash / Paid)", f"₹{cash_sales:.2f}"),
                        ("उधारी विक्री (Credit)", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 आजची विक्री: **₹{today_rev:.2f}** ({today_cnt} बिले)*"
                else:
                    intro = "**All-Time Sales Summary**\nHere is your store's total sales overview:"
                    col_h = ("Metric", "Value")
                    rows = [
                        ("Total Revenue", f"**₹{total_rev:.2f}**"),
                        ("Total Transactions", f"**{total_tx} bills**"),
                        ("Paid / Settled Sales", f"₹{cash_sales:.2f}"),
                        ("Credit (Udhaar) Sales", f"₹{credit_sales:.2f}")
                    ]
                    footnote = f"\n\n*📌 Today's Sales: **₹{today_rev:.2f}** across {today_cnt} bills.*"

                sale_chunks = [c for c in chunks if c["type"] == "SALE_RECORD"][:top_k]

            table_lines = [
                f"| {col_h[0]} | {col_h[1]} |",
                "| :--- | :---: |"
            ]
            for r in rows:
                table_lines.append(f"| {r[0]} | {r[1]} |")

            answer = f"{intro}\n\n" + "\n".join(table_lines) + footnote

            sources = [{
                "doc_type": c["type"],
                "reference_id": c["doc_id"],
                "relevance_score": 0.95,
                "excerpt": c["text"],
                "metadata": c.get("metadata", {})
            } for c in sale_chunks]

            return {
                "query": user_query,
                "language": lang,
                "answer": answer,
                "sources": sources,
                "confidence": 0.95
            }

        # Intent 2B: Profit Query (Today, Weekly, Monthly, All-time)
        if is_profit_query:
            from datetime import datetime, timedelta

            recent_sales = store_data.get("recent_sales", [])
            today_date_str = store_data.get("today_date", "")
            if not today_date_str:
                today_date_str = datetime.now().strftime("%Y-%m-%d")

            try:
                today_obj = datetime.strptime(today_date_str[:10], "%Y-%m-%d").date()
            except Exception:
                today_obj = datetime.now().date()

            # Month names dictionary with English, Gujarati, and Hindi names
            month_names = {
                1: {"name": "January", "gu": "જાન્યુઆરી", "hi": "जनवरी", "mr": "जानेवारी", "aliases": ["january", "jan", "જાન્યુઆરી", "जनवरी"]},
                2: {"name": "February", "gu": "ફેબ્રુઆરી", "hi": "फरवरी", "mr": "फेब्रुवारी", "aliases": ["february", "feb", "ફેબ્રુઆરી", "फरवरी"]},
                3: {"name": "March", "gu": "માર્ચ", "hi": "मार्च", "mr": "मार्च", "aliases": ["march", "mar", "માર્ચ", "मार्च"]},
                4: {"name": "April", "gu": "એપ્રિલ", "hi": "अप्रैल", "mr": "एप्रिल", "aliases": ["april", "apr", "એપ્રિલ", "अप्रैल"]},
                5: {"name": "May", "gu": "મે", "hi": "मई", "mr": "मे", "aliases": ["may", "મે", "मई"]},
                6: {"name": "June", "gu": "જૂન", "hi": "जून", "mr": "जून", "aliases": ["june", "jun", "જૂન", "जून"]},
                7: {"name": "July", "gu": "જુલાઈ", "hi": "जुलाई", "mr": "जुलै", "aliases": ["july", "jul", "જુલાઈ", "जुलाई"]},
                8: {"name": "August", "gu": "ઓગસ્ટ", "hi": "अगस्त", "mr": "ऑगस्ट", "aliases": ["august", "aug", "ઓગસ્ટ", "अगस्त"]},
                9: {"name": "September", "gu": "સપ્ટેમ્બર", "hi": "सितंबर", "mr": "सप्टेंबर", "aliases": ["september", "sep", "સપ્ટેમ્બર", "सितंबर"]},
                10: {"name": "October", "gu": "ઓક્ટોબર", "hi": "अक्टूबर", "mr": "ऑक्टोबर", "aliases": ["october", "oct", "ઓક્ટોબર", "अक्टूबर"]},
                11: {"name": "November", "gu": "નવેમ્બર", "hi": "नवंबर", "mr": "नोव्हेंबर", "aliases": ["november", "nov", "નવેમ્બર", "नवंबर"]},
                12: {"name": "December", "gu": "ડિસેમ્બર", "hi": "दिसंबर", "mr": "डिसेंबर", "aliases": ["december", "dec", "ડિસેમ્બર", "दिसंबर"]}
            }

            matched_month_info = None
            for m_num, m_data in month_names.items():
                if any(alias in query_lower for alias in m_data["aliases"]):
                    matched_month_info = m_data
                    target_month = m_num
                    break
            else:
                target_month = None

            # Determine period requested by user
            is_weekly = any(w in query_lower for w in ["week", "weekly", "7 day", "7 days", "અઠવાડિયું", "અઠવાડિયા", "સપ્તાહ", "हफ्ता", "साप्ताहिक", "आठवडा"])
            is_monthly = matched_month_info is not None or any(m in query_lower for m in ["month", "monthly", "30 day", "30 days", "મહિનો", "મહિના", "માસિક", "महीना", "माह", "मासिक"])
            is_today = not (is_weekly or is_monthly) and any(t in query_lower for t in ["today", "today's", "aaj", "aaje", "આજે", "આજનો", "આજનો નફો", "आज", "आजचा", "आजचे"])

            # Filter sales matching the requested period
            matched_sales = []
            period_label = "all_time"

            if is_today:
                period_label = "today"
                today_sales_list = store_data.get("today_sales")
                if today_sales_list is not None and len(today_sales_list) > 0:
                    matched_sales = today_sales_list
                else:
                    for s in recent_sales:
                        raw_d = str(s.get("sale_date") or s.get("created_at") or "")[:10]
                        if raw_d == today_date_str[:10]:
                            matched_sales.append(s)
            elif is_weekly:
                period_label = "weekly"
                week_ago = today_obj - timedelta(days=7)
                for s in recent_sales:
                    raw_d = str(s.get("sale_date") or s.get("created_at") or "")[:10]
                    try:
                        s_dt = datetime.strptime(raw_d, "%Y-%m-%d").date()
                        if s_dt >= week_ago:
                            matched_sales.append(s)
                    except Exception:
                        pass
            elif is_monthly:
                period_label = "monthly"
                if target_month:
                    for s in recent_sales:
                        raw_d = str(s.get("sale_date") or s.get("created_at") or "")[:10]
                        try:
                            s_dt = datetime.strptime(raw_d, "%Y-%m-%d").date()
                            if s_dt.month == target_month:
                                matched_sales.append(s)
                        except Exception:
                            pass
                else:
                    month_ago = today_obj - timedelta(days=30)
                    for s in recent_sales:
                        raw_d = str(s.get("sale_date") or s.get("created_at") or "")[:10]
                        try:
                            s_dt = datetime.strptime(raw_d, "%Y-%m-%d").date()
                            if s_dt >= month_ago:
                                matched_sales.append(s)
                        except Exception:
                            pass
            else:
                # Default to today if query asks "give me profit" or similar without period, else all time
                if "today" in query_lower or "aaj" in query_lower or "આજ" in query_lower:
                    period_label = "today"
                    for s in recent_sales:
                        raw_d = str(s.get("sale_date") or s.get("created_at") or "")[:10]
                        if raw_d == today_date_str[:10]:
                            matched_sales.append(s)
                else:
                    period_label = "all_time"
                    matched_sales = recent_sales

            # Calculate total profit, total sales, and bill count
            total_profit = sum(float(s.get("profit") or 0) for s in matched_sales)
            total_sales_amt = sum(float(s.get("total_amount") or 0) for s in matched_sales)
            bill_count = len(matched_sales)

            # Generate simple, user-friendly response
            if period_label == "today":
                if bill_count == 0:
                    if lang == "gu":
                        ans = f"આજે હજુ સુધી કોઈ નવું વેચાણ થયેલું નથી, તેથી આજનો નફો **₹0.00** છે."
                    elif lang == "hi":
                        ans = f"आज अभी तक कोई नई बिक्री दर्ज नहीं हुई है, इसलिए आज का मुनाफा **₹0.00** है।"
                    elif lang == "mr":
                        ans = f"आज अद्याप कोणतीही नवीन विक्री झालेली नाही, त्यामुळे आजचा नफा **₹0.00** आहे."
                    else:
                        ans = f"No sales recorded yet for today, so today's total profit is **₹0.00**."
                else:
                    if lang == "gu":
                        ans = f"આજનો તમારો કુલ નફો **₹{total_profit:.2f}** છે (કુલ વેચાણ: **₹{total_sales_amt:.2f}**, {bill_count} બિલ)."
                    elif lang == "hi":
                        ans = f"आज का आपका कुल मुनाफा **₹{total_profit:.2f}** है (कुल बिक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिल)।"
                    elif lang == "mr":
                        ans = f"आजचा आपला एकूण नफा **₹{total_profit:.2f}** आहे (एकूण विक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिले)."
                    else:
                        ans = f"Today's total profit is **₹{total_profit:.2f}** (total sales: **₹{total_sales_amt:.2f}** across {bill_count} bills)."

            elif period_label == "weekly":
                if lang == "gu":
                    ans = f"છેલ્લા ૭ દિવસનો (સાપ્તાહિક) તમારો કુલ નફો **₹{total_profit:.2f}** છે (કુલ વેચાણ: **₹{total_sales_amt:.2f}**, {bill_count} બિલ)."
                elif lang == "hi":
                    ans = f"पिछले 7 दिनों का (साप्ताहिक) आपका कुल मुनाफा **₹{total_profit:.2f}** है (कुल बिक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिल)।"
                elif lang == "mr":
                    ans = f"मागील ७ दिवसांचा (साप्ताहिक) आपला एकूण नफा **₹{total_profit:.2f}** आहे (एकूण विक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिले)."
                else:
                    ans = f"Your weekly profit (last 7 days) is **₹{total_profit:.2f}** (total sales: **₹{total_sales_amt:.2f}** across {bill_count} bills)."

            elif period_label == "monthly":
                if matched_month_info:
                    m_label = matched_month_info.get(lang, matched_month_info["name"])
                    if lang == "gu":
                        ans = f"{m_label} મહિનાનો તમારો કુલ નફો **₹{total_profit:.2f}** છે (કુલ વેચાણ: **₹{total_sales_amt:.2f}**, {bill_count} બિલ)."
                    elif lang == "hi":
                        ans = f"{m_label} महीने का आपका कुल मुनाफा **₹{total_profit:.2f}** है (कुल बिक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिल)।"
                    elif lang == "mr":
                        ans = f"{m_label} महिन्याचा आपला एकूण नफा **₹{total_profit:.2f}** आहे (एकूण विक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिले)."
                    else:
                        ans = f"Your {m_label} profit is **₹{total_profit:.2f}** (total sales: **₹{total_sales_amt:.2f}** across {bill_count} bills)."
                else:
                    if lang == "gu":
                        ans = f"છેલ્લા ૩૦ દિવસનો (માસિક) તમારો કુલ નફો **₹{total_profit:.2f}** છે (કુલ વેચાણ: **₹{total_sales_amt:.2f}**, {bill_count} બિલ)."
                    elif lang == "hi":
                        ans = f"पिछले 30 दिनों का (मासिक) आपका कुल मुनाफा **₹{total_profit:.2f}** है (कुल बिक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिल)।"
                    elif lang == "mr":
                        ans = f"मागील ३० दिवसांचा (मासिक) आपला एकूण नफा **₹{total_profit:.2f}** आहे (एकूण विक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिले)."
                    else:
                        ans = f"Your monthly profit (last 30 days) is **₹{total_profit:.2f}** (total sales: **₹{total_sales_amt:.2f}** across {bill_count} bills)."

            else:
                if lang == "gu":
                    ans = f"તમારો એકંદર કુલ નફો **₹{total_profit:.2f}** છે (કુલ નોંધાયેલ વેચાણ: **₹{total_sales_amt:.2f}**, {bill_count} બિલ)."
                elif lang == "hi":
                    ans = f"आपका अब तक का कुल मुनाफा **₹{total_profit:.2f}** है (कुल बिक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिल)।"
                elif lang == "mr":
                    ans = f"आपला एकूण नफा **₹{total_profit:.2f}** आहे (एकूण विक्री: **₹{total_sales_amt:.2f}**, {bill_count} बिले)."
                else:
                    ans = f"Your total profit is **₹{total_profit:.2f}** (total sales: **₹{total_sales_amt:.2f}** across {bill_count} bills)."

            # Filter source chunks matching the matched bills
            matched_bill_nos = set(s.get("bill_number") or f"BILL-{s.get('id')}" for s in matched_sales)
            profit_chunks = [c for c in chunks if c["type"] == "SALE_RECORD" and c["doc_id"] in matched_bill_nos][:top_k]
            if not profit_chunks and matched_sales:
                profit_chunks = [c for c in chunks if c["type"] == "SALE_RECORD"][:top_k]

            sources = [{
                "doc_type": c["type"],
                "reference_id": c["doc_id"],
                "relevance_score": 0.95,
                "excerpt": c["text"],
                "metadata": c.get("metadata", {})
            } for c in profit_chunks]

            return {
                "query": user_query,
                "language": lang,
                "answer": ans,
                "sources": sources,
                "confidence": 0.95
            }

        # Intent 3: Recent Supplier Purchases Query
        if is_recent_purchases_query:
            purchases = store_data.get("purchases", [])
            if purchases:
                if lang == "gu":
                    intro = "**તાજેતરના સપ્લાયર બિલ (ઇનવોઇસ)**\nતમારા સપ્લાયર્સ પાસેથી આવેલા તાજેતરના બિલ નીચે મુજબ છે:"
                    col_h = ("સપ્લાયરનું નામ", "ઇનવોઇસ નંબર", "તારીખ", "કુલ રકમ")
                elif lang == "hi":
                    intro = "**हाल के सप्लायर इनवॉइस**\nआपके सप्लायर्स से प्राप्त हाल के बिल नीचे दिए गए हैं:"
                    col_h = ("सप्लायर का नाम", "इनवॉइस नंबर", "दिनांक", "कुल राशि")
                elif lang == "mr":
                    intro = "**अलीकडील पुरवठादार बिले (इनव्हॉइस)**\nआपल्या पुरवठादारांकडून आलेली अलीकडील बिले खालीलप्रमाणे आहेत:"
                    col_h = ("पुरवठादाराचे नाव", "इनव्हॉइस क्रमांक", "दिनांक", "एकूण रक्कम")
                else:
                    intro = "**Recent Supplier Invoices**\nHere are your recent purchase invoices from suppliers:"
                    col_h = ("Supplier Name", "Invoice No", "Date", "Total Amount")

                table_lines = [
                    f"| {col_h[0]} | {col_h[1]} | {col_h[2]} | {col_h[3]} |",
                    "| :--- | :--- | :--- | :---: |"
                ]
                for p in purchases[:5]:
                    sup = p.get("supplier_name", "Supplier")
                    inv_no = p.get("invoice_no") or f"PUR-{p.get('id')}"
                    p_date = str(p.get("purchase_date") or "")[:10] or "—"
                    p_total = float(p.get("total_amount") or 0)
                    table_lines.append(f"| **{sup}** | {inv_no} | {p_date} | ₹{p_total:.2f} |")

                answer = f"{intro}\n\n" + "\n".join(table_lines)
            else:
                answer = {
                    "gu": "કોઈપણ સપ્લાયર ઇનવોઇસ રેકોર્ડ મળેલ નથી.",
                    "hi": "कोई सप्लायर इनवॉइस रिकॉर्ड नहीं मिला।",
                    "mr": "कोणतीही पुरवठादार इनव्हॉइस नोंद आढळली नाही.",
                    "en": "No supplier purchase invoices have been recorded yet."
                }.get(lang, "No supplier purchase invoices have been recorded yet.")

            pur_chunks = [c for c in chunks if c["type"] == "SUPPLIER_INVOICE"][:top_k]
            sources = [{
                "doc_type": c["type"],
                "reference_id": c["doc_id"],
                "relevance_score": 0.95,
                "excerpt": c["text"],
                "metadata": c.get("metadata", {})
            } for c in pur_chunks]

            return {
                "query": user_query,
                "language": lang,
                "answer": answer,
                "sources": sources,
                "confidence": 0.95
            }

        # Intent 4: Customer Credit / Udhaar Query
        if is_credit_query:
            credit_chunks = [c for c in chunks if c["type"] == "CUSTOMER_CREDIT"]
            if credit_chunks:
                translit_query = indic_to_latin(query_lower)
                query_skel = consonant_skel(translit_query)

                matched_credit_chunks = []
                for c in credit_chunks:
                    c_name = c["customer"].strip().lower()
                    parts = [p for p in c_name.split() if len(p) >= 3]
                    if c_name in query_lower or any(p in query_lower for p in parts):
                        matched_credit_chunks.append(c)
                        continue
                    if c_name in translit_query or any(p in translit_query for p in parts):
                        matched_credit_chunks.append(c)
                        continue
                    for p in parts:
                        p_skel = consonant_skel(p)
                        if len(p_skel) >= 3 and p_skel in query_skel:
                            matched_credit_chunks.append(c)
                            break

                col_headers = {
                    "gu": ("ગ્રાહકનું નામ", "તારીખ", "બિલ નંબર", "બાકી રકમ", "કુલ બાકી ઉધાર"),
                    "hi": ("ग्राहक का नाम", "दिनांक", "बिल नंबर", "बकाया राशि", "कुल बकाया उधार"),
                    "mr": ("ग्राहकाचे नाव", "दिनांक", "बिल क्रमांक", "बाकी रक्कम", "एकूण बाकी उधारी"),
                    "en": ("Customer Name", "Date", "Bill No", "Due Amount", "Total Due")
                }.get(lang, ("Customer Name", "Date", "Bill No", "Due Amount", "Total Due"))

                intro_texts = {
                    "gu": "**બાકી ઉધાર ખાતાવહી (Udhaar Summary)**\nદુકાનમાં બાકી ઉધાર ધરાવતા ગ્રાહકોની વિગત નીચે મુજબ છે:",
                    "hi": "**बकाया उधार विवरण (Udhaar Summary)**\nदुकान में बकाया उधार वाले ग्राहकों की सूची नीचे दी गई है:",
                    "mr": "**बाकी उधारी तपशील (Udhaar Summary)**\nदुकानातील बाकी उधारी असलेल्या ग्राहकांची यादी खालीलप्रमाणे आहे:",
                    "en": "**Customer Credit Summary (Udhaar)**\nHere is the summary of customers with outstanding balances:"
                }

                if matched_credit_chunks:
                    primary_cust = matched_credit_chunks[0]["customer"]
                    cust_chunks = [c for c in matched_credit_chunks if c["customer"].lower() == primary_cust.lower()]
                    cust_total = sum(c["amount"] for c in cust_chunks)

                    if lang == "gu":
                        intro = f"ગ્રાહક **{primary_cust}** નું બાકી ઉધાર નીચે મુજબ છે:"
                        summary_footer = f"કુલ બાકી રકમ: **₹{cust_total:.2f}**"
                    elif lang == "hi":
                        intro = f"ग्राहक **{primary_cust}** का बकाया उधार नीचे दिया गया है:"
                        summary_footer = f"कुल बकाया राशि: **₹{cust_total:.2f}**"
                    elif lang == "mr":
                        intro = f"ग्राहक **{primary_cust}** ची बाकी उधारी खालीलप्रमाणे आहे:"
                        summary_footer = f"एकूण बाकी रक्कम: **₹{cust_total:.2f}**"
                    else:
                        intro = f"Outstanding credit details for customer **{primary_cust}**:"
                        summary_footer = f"Total balance due: **₹{cust_total:.2f}**"

                    table_lines = [
                        f"| {col_headers[0]} | {col_headers[1]} | {col_headers[2]} | {col_headers[3]} |",
                        "| :--- | :--- | :--- | :---: |"
                    ]
                    for c in cust_chunks:
                        table_lines.append(f"| {c['customer']} | {c.get('date') or '—'} | {c.get('doc_id') or '—'} | ₹{c['amount']:.2f} |")

                    if len(cust_chunks) > 1:
                        table_lines.append(f"| **{col_headers[4]}** | | | **₹{cust_total:.2f}** |")

                    answer = f"{intro}\n\n" + "\n".join(table_lines) + f"\n\n{summary_footer}"
                    relevant_chunks = cust_chunks
                else:
                    total_amt = sum(c["amount"] for c in credit_chunks)
                    unique_customers = len(set(c["customer"] for c in credit_chunks))
                    intro = intro_texts.get(lang, intro_texts["en"])

                    table_lines = [
                        f"| {col_headers[0]} | {col_headers[1]} | {col_headers[2]} | {col_headers[3]} |",
                        "| :--- | :--- | :--- | :---: |"
                    ]
                    for c in credit_chunks:
                        table_lines.append(f"| {c['customer']} | {c.get('date') or '—'} | {c.get('doc_id') or '—'} | ₹{c['amount']:.2f} |")

                    table_lines.append(f"| **{col_headers[4]}** | | | **₹{total_amt:.2f}** |")

                    if lang == "gu":
                        summary_footer = f"કુલ **{unique_customers} ગ્રાહકો** નું મળીને કુલ **₹{total_amt:.2f}** ઉધાર બાકી છે."
                    elif lang == "hi":
                        summary_footer = f"कुल **{unique_customers} ग्राहकों** का मिलाकर कुल बकाया **₹{total_amt:.2f}** है।"
                    elif lang == "mr":
                        summary_footer = f"एकूण **{unique_customers} ग्राहकांची** मिळून एकूण बाकी **₹{total_amt:.2f}** आहे."
                    else:
                        summary_footer = f"Total outstanding credit across **{unique_customers} customer(s)** is **₹{total_amt:.2f}**."

                    answer = f"{intro}\n\n" + "\n".join(table_lines) + f"\n\n{summary_footer}"
                    relevant_chunks = credit_chunks

                sources = [{
                    "doc_type": c["type"],
                    "reference_id": c["doc_id"],
                    "relevance_score": 0.95,
                    "excerpt": c["text"],
                    "metadata": c.get("metadata", {})
                } for c in relevant_chunks[:top_k]]

                return {
                    "query": user_query,
                    "language": lang,
                    "answer": answer,
                    "sources": sources,
                    "confidence": 0.95
                }
            else:
                return {
                    "query": user_query,
                    "language": lang,
                    "answer": t["no_credit"],
                    "sources": [],
                    "confidence": 0.90
                }

        # Intent 5: Supplier Rate / Cheapest Purchase Query
        if is_supplier_rate_query:
            invoice_chunks = [c for c in chunks if c["type"] == "SUPPLIER_INVOICE"]
            if detected_product:
                filtered_invoices = [
                    c for c in invoice_chunks
                    if detected_product in c["product"].lower() or c["product"].lower() in detected_product
                ]
            else:
                filtered_invoices = invoice_chunks

            if filtered_invoices:
                valid_invoices = [c for c in filtered_invoices if c["price"] > 0]
                candidates = valid_invoices if valid_invoices else filtered_invoices
                cheapest = min(candidates, key=lambda x: x["price"])

                summary_text = t["cheapest_supplier"].format(
                    supplier=cheapest["supplier"],
                    product=cheapest["product"],
                    price=cheapest["price"],
                    invoice_no=cheapest["doc_id"],
                    date=cheapest["date"]
                )

                col_headers = {
                    "gu": ("સપ્લાયરનું નામ", "પ્રોડક્ટ", "ખરીદ ભાવ", "જથ્થો", "ઇનવોઇસ", "તારીખ"),
                    "hi": ("सप्लायर का नाम", "उत्पाद", "खरीद दर", "मात्रा", "इनवॉइस", "दिनांक"),
                    "mr": ("पुरवठादाराचे नाव", "उत्पादन", "खरेदी दर", "प्रमाण", "इनव्हॉइस", "दिनांक"),
                    "en": ("Supplier Name", "Product", "Unit Rate", "Quantity", "Invoice No", "Date")
                }.get(lang, ("Supplier Name", "Product", "Unit Rate", "Quantity", "Invoice No", "Date"))

                badge_label = {
                    "gu": " ⭐ (શ્રેષ્ઠ ભાવ)",
                    "hi": " ⭐ (सर्वोत्तम दर)",
                    "mr": " ⭐ (उत्तम दर)",
                    "en": " ⭐ (Best Price)"
                }.get(lang, " ⭐ (Best Price)")

                table_lines = [
                    f"| {col_headers[0]} | {col_headers[1]} | {col_headers[2]} | {col_headers[3]} | {col_headers[4]} | {col_headers[5]} |",
                    "| :--- | :--- | :---: | :---: | :--- | :--- |"
                ]
                for inv in candidates[:5]:
                    is_cheapest = inv["doc_id"] == cheapest["doc_id"]
                    badge = badge_label if is_cheapest else ""
                    table_lines.append(
                        f"| {inv['supplier']}{badge} | {inv['product']} | **₹{inv['price']:.2f}** | {inv['quantity']} | {inv['doc_id']} | {inv['date']} |"
                    )

                answer = f"{summary_text}\n\n" + "\n".join(table_lines)

                sources = [{
                    "doc_type": c["type"],
                    "reference_id": c["doc_id"],
                    "relevance_score": 0.95 if c["doc_id"] == cheapest["doc_id"] else 0.85,
                    "excerpt": c["text"],
                    "metadata": c.get("metadata", {})
                } for c in (filtered_invoices[:top_k] or invoice_chunks[:top_k])]

                return {
                    "query": user_query,
                    "language": lang,
                    "answer": answer,
                    "sources": sources,
                    "confidence": 0.95
                }

        # ==========================================
        # FALLBACK: VECTOR EMBEDDING SEMANTIC SEARCH
        # ==========================================
        chunk_texts = [c["text"] for c in chunks]
        chunk_embeddings = self.encoder.encode(chunk_texts, convert_to_numpy=True)
        query_embedding = self.encoder.encode([user_query], convert_to_numpy=True)

        similarities = cosine_similarity(query_embedding, chunk_embeddings)[0]
        ranked_indices = np.argsort(similarities)[::-1][:top_k]

        matched_chunks = []
        for idx in ranked_indices:
            score = float(similarities[idx])
            if score >= 0.15:
                c = dict(chunks[idx])
                c["similarity"] = round(score, 4)
                matched_chunks.append(c)

        if not matched_chunks:
            return {
                "query": user_query,
                "language": lang,
                "answer": t["not_found"].format(query=user_query),
                "sources": [],
                "confidence": float(similarities[ranked_indices[0]]) if len(ranked_indices) > 0 else 0.0
            }

        best_match = matched_chunks[0]
        confidence = best_match["similarity"]

        # Format user-friendly answer based on matched document type
        doc_type = best_match.get("type")
        if doc_type == "INVENTORY":
            p_name = best_match.get("product", "Product")
            stock_val = best_match.get("stock", 0)
            sp_val = best_match.get("selling_price", 0)
            if lang == "gu":
                formatted_ans = f"**{p_name}** નો હાલનો સ્ટોક **{stock_val} યુનિટ** છે અને વેચાણ કિંમત **₹{sp_val:.2f}** છે."
            elif lang == "hi":
                formatted_ans = f"**{p_name}** का वर्तमान स्टॉक **{stock_val} यूनिट** है और विक्रय मूल्य **₹{sp_val:.2f}** है।"
            elif lang == "mr":
                formatted_ans = f"**{p_name}** चा सध्याचा साठा **{stock_val} युनिट** आहे आणि विक्री दर **₹{sp_val:.2f}** आहे."
            else:
                formatted_ans = f"**{p_name}** has **{stock_val} units** currently in stock at a selling price of **₹{sp_val:.2f}**."
        elif doc_type == "SUPPLIER_INVOICE":
            p_name = best_match.get("product", "Product")
            sup_name = best_match.get("supplier", "Supplier")
            pr_val = best_match.get("price", 0)
            inv_ref = best_match.get("doc_id", "")
            d_val = best_match.get("date", "")
            if lang == "gu":
                formatted_ans = f"ઇનવોઇસ #{inv_ref} ({d_val}) મુજબ સપ્લાયર **{sup_name}** એ **{p_name}** નો ભાવ **₹{pr_val:.2f}** પ્રતિ યુનિટ આપ્યો છે."
            elif lang == "hi":
                formatted_ans = f"इनवॉइस #{inv_ref} ({d_val}) के अनुसार सप्लायर **{sup_name}** ने **{p_name}** का भाव **₹{pr_val:.2f}** प्रति यूनिट दिया है।"
            elif lang == "mr":
                formatted_ans = f"इनव्हॉइस #{inv_ref} ({d_val}) नुसार पुरवठादार **{sup_name}** यांनी **{p_name}** चा दर **₹{pr_val:.2f}** प्रति नग दिला आहे."
            else:
                formatted_ans = f"According to Invoice #{inv_ref} ({d_val}), supplier **{sup_name}** supplied **{p_name}** at **₹{pr_val:.2f}** per unit."
        elif doc_type == "CUSTOMER_CREDIT":
            c_name = best_match.get("customer", "Customer")
            amt_val = best_match.get("amount", 0)
            b_ref = best_match.get("doc_id", "")
            if lang == "gu":
                formatted_ans = f"ગ્રાહક **{c_name}** નું બિલ #{b_ref} પર **₹{amt_val:.2f}** નું ઉધાર બાકી છે."
            elif lang == "hi":
                formatted_ans = f"ग्राहक **{c_name}** का बिल #{b_ref} पर **₹{amt_val:.2f}** का उधार बकाया है।"
            elif lang == "mr":
                formatted_ans = f"ग्राहक **{c_name}** कडे बिल #{b_ref} वर **₹{amt_val:.2f}** ची उधारी बाकी आहे."
            else:
                formatted_ans = f"Customer **{c_name}** currently has an outstanding credit balance of **₹{amt_val:.2f}** under Bill #{b_ref}."
        elif doc_type == "SALE_RECORD":
            amt_val = best_match.get("amount", 0)
            b_ref = best_match.get("doc_id", "")
            d_val = best_match.get("date", "")
            if lang == "gu":
                formatted_ans = f"વેચાણ બિલ #{b_ref} (તારીખ: {d_val}) ની કુલ રકમ **₹{amt_val:.2f}** છે."
            elif lang == "hi":
                formatted_ans = f"बिक्री बिल #{b_ref} (दिनांक: {d_val}) की कुल राशि **₹{amt_val:.2f}** है।"
            elif lang == "mr":
                formatted_ans = f"विक्री बिल #{b_ref} (दिनांक: {d_val}) ची एकूण रक्कम **₹{amt_val:.2f}** आहे."
            else:
                formatted_ans = f"Sale Bill #{b_ref} dated {d_val} has a total amount of **₹{amt_val:.2f}**."
        else:
            formatted_ans = best_match["text"]

        sources = []
        for c in matched_chunks:
            sources.append({
                "doc_type": c["type"],
                "reference_id": c["doc_id"],
                "relevance_score": c["similarity"],
                "excerpt": c["text"],
                "metadata": c.get("metadata", {})
            })

        return {
            "query": user_query,
            "language": lang,
            "answer": formatted_ans,
            "sources": sources,
            "confidence": confidence
        }


rag_engine = LocalStoreRAG()

"""eldorado_sellers.py — copia a lógica de Documents/eldorado (types/optimizer/parser).

Vê TODOS os vendedores via API (não só a tela), filtra por tempo máximo de
entrega (expectedTime, ex: "19 min - 1 h" -> max 60 -> rejeitado se >20min) e
ranqueia pelo menor custo total com taxa (8.53% + fixa R$1.16, igual ao
optimizer.ts) — espelhando findBestOffer: menor total > menor preço >
maior rating > mais reviews, dedup por vendedor.
"""
import re

BASE_WWW = "https://www.eldorado.gg"
FEE_PERCENT = 8.53
FIXED_FEE = 1.16


def parse_hms(s):
    # "01:00:00" ou "1.00:00:00" (dias.HH:MM:SS) -> minutos (float)
    if not s:
        return None
    m = re.match(r"(?:(\d+)\.)?(\d+):(\d+):([\d.]+)", str(s).strip())
    if not m:
        return None
    days, h, mi, sec = m.groups()
    return int(days or 0) * 1440 + int(h) * 60 + int(mi) + float(sec) / 60.0


# tier prometido pelo vendedor quando deliveryTime vem nulo (ex: Minute20 -> 20min)
GUARANTEE_MIN = {"Minute20": 20, "Hour1": 60, "Hour2": 120, "Hour3": 180,
                 "Hour5": 300, "Hour8": 480, "Hour12": 720, "Day1": 1440,
                 "Day2": 2880, "Day3": 4320, "Day7": 10080, "Day14": 20160,
                 "Day28": 40320, "Day45": 64800, "Day60": 86400}


def fetch_all_sellers(s, headers, game_id="70", category="Currency", page_size=150):
    # puxa todas as páginas (recordCount 116, 1 página hoje, mas pagina por segurança)
    out = []
    page = 1
    while True:
        u = (f"{BASE_WWW}/api/predefinedOffers/augmentedGame/offers"
             f"?gameId={game_id}&category={category}&pageIndex={page}&pageSize={page_size}")
        r = s.get(u, headers=headers, timeout=30)
        r.raise_for_status()
        d = r.json()
        out.extend(d.get("results", []))
        if page >= int(d.get("totalPages", 1)):
            break
        page += 1
    return out


def to_offer(res, position):
    offer = res.get("offer", {})
    user = res.get("user", {})
    info = res.get("userOrderInfo", {})
    dt = res.get("deliveryTime", {}) or {}
    price = (offer.get("pricePerUnit") or {}).get("amount", 0)
    fx = (offer.get("exchangeRate") or {}).get("exchangeRate", 0)
    fb = info.get("feedbackScore")
    rating = float(fb) if fb is not None else 0.0
    rc = info.get("ratingCount")
    reviews = int(rc) if rc is not None else 0
    max_min = parse_hms(dt.get("expectedTime"))
    if max_min is None:
        max_min = GUARANTEE_MIN.get(offer.get("guaranteedDeliveryTime"))
    return {
        "sellerName": user.get("username", f"Vendedor #{position}"),
        "offerId": offer.get("id", ""),
        "offerVersion": int(offer.get("offerVersion", 0) or 0),
        "pricePerUnit": float(price or 0),
        "minQty": int(offer.get("minQuantity", 1) or 1),
        "stock": int(offer.get("quantity", 0) or 0),
        "verified": bool(user.get("isVerifiedSeller", False)),
        "ratingPercent": rating,
        "reviewCount": reviews,
        "deliveryMedianMin": parse_hms(dt.get("deliveryTimeMedian")),
        "deliveryMaxMin": max_min,  # None = sem dado -> rejeitado no filtro
        "guarantee": offer.get("guaranteedDeliveryTime", ""),
        "fx": float(fx or 0),
        "position": position,  # 1-based na ordem do listing (igual offerPosition do top=1)
    }


def total_for(price_per_unit, quantity, fee_percent=FEE_PERCENT, fixed_fee=FIXED_FEE):
    sub = round(quantity * price_per_unit, 2)
    fee = round(sub * fee_percent / 100.0 + fixed_fee, 2)
    return round(sub + fee, 2), sub, fee


def units_for_budget(price_per_unit, min_qty, stock, budget,
                     fee_percent=FEE_PERCENT, fixed_fee=FIXED_FEE):
    # espelho do evaluateOffer (optimizer.ts): orçamento efetivo -> unidades
    if price_per_unit <= 0 or budget <= fixed_fee:
        return None
    mult = 1 + fee_percent / 100.0
    units = int((budget - fixed_fee) / mult // price_per_unit)
    if units < min_qty:
        return None
    units = min(units, stock)
    if units < min_qty:
        return None
    total, sub, fee = total_for(price_per_unit, units, fee_percent, fixed_fee)
    return {"units": units, "subtotal": sub, "fee": fee, "total": total,
            "difference": round(budget - total, 2)}


def select_best(sellers_raw, quantity, max_delivery_min=20.0, min_rating=90.0):
    # 1. normaliza + 2. filtra tempo (max>limite ou desconhecido rejeita) + rating + min/estoque
    cands, rejected = [], []
    for i, res in enumerate(sellers_raw, start=1):
        o = to_offer(res, i)
        if not o["offerId"] or o["pricePerUnit"] <= 0:
            continue
        if o["deliveryMaxMin"] is None:
            rejected.append((o["sellerName"], "sem dado de entrega"))
            continue
        if o["deliveryMaxMin"] > max_delivery_min:
            rejected.append((o["sellerName"], f"entrega max {o['deliveryMaxMin']:.0f}min > {max_delivery_min:.0f}min"))
            continue
        if o["ratingPercent"] < min_rating:
            rejected.append((o["sellerName"], f"rating {o['ratingPercent']:.1f}% < {min_rating}%"))
            continue
        if quantity < o["minQty"]:
            rejected.append((o["sellerName"], f"min {o['minQty']} > qty {quantity}"))
            continue
        if quantity > o["stock"]:
            rejected.append((o["sellerName"], f"estoque {o['stock']} < qty {quantity}"))
            continue
        total, sub, fee = total_for(o["pricePerUnit"], quantity)
        o.update(total=total, subtotal=sub, fee=fee)
        cands.append(o)
    # 3. ranking igual findBestOffer: menor total > menor preço > maior rating > mais reviews
    cands.sort(key=lambda o: (o["total"], o["pricePerUnit"], -o["ratingPercent"], -o["reviewCount"]))
    # 4. dedup por vendedor
    seen, ranked = set(), []
    for o in cands:
        k = o["sellerName"].lower().strip()
        if k not in seen:
            seen.add(k)
            ranked.append(o)
    return (ranked[0] if ranked else None), ranked, rejected


def select_best_for_budget(sellers_raw, budget, max_delivery_min=20.0, min_rating=90.0):
    # modo valor: calcula unidades por vendedor a partir do orçamento e ranqueia
    # por menor |diferença| (espelho do findBestOffer) — ver Documents/eldorado
    cands, rejected = [], []
    for i, res in enumerate(sellers_raw, start=1):
        o = to_offer(res, i)
        if not o["offerId"] or o["pricePerUnit"] <= 0:
            continue
        if o["deliveryMaxMin"] is None:
            rejected.append((o["sellerName"], "sem dado de entrega"))
            continue
        if o["deliveryMaxMin"] > max_delivery_min:
            rejected.append((o["sellerName"], f"entrega max {o['deliveryMaxMin']:.0f}min > {max_delivery_min:.0f}min"))
            continue
        if o["ratingPercent"] < min_rating:
            rejected.append((o["sellerName"], f"rating {o['ratingPercent']:.1f}% < {min_rating}%"))
            continue
        calc = units_for_budget(o["pricePerUnit"], o["minQty"], o["stock"], budget)
        if not calc:
            rejected.append((o["sellerName"], f"orçamento não atinge min {o['minQty']} un"))
            continue
        o.update(total=calc["total"], subtotal=calc["subtotal"], fee=calc["fee"],
                 units=calc["units"], difference=calc["difference"])
        cands.append(o)
    cands.sort(key=lambda o: (abs(o["difference"]), o["pricePerUnit"],
                              -o["ratingPercent"], -o["reviewCount"]))
    seen, ranked = set(), []
    for o in cands:
        k = o["sellerName"].lower().strip()
        if k not in seen:
            seen.add(k)
            ranked.append(o)
    return (ranked[0] if ranked else None), ranked, rejected

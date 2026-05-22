#!/usr/bin/env python3
import argparse
import json
import math
from typing import Any, Optional


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate yfinance symbol candidates (manual, no DB writes)")
    parser.add_argument("--isin", default=None)
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--input", default=None, help="Optional JSON input file with candidates")
    parser.add_argument("--period", default="1y")
    parser.add_argument("--actions", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--out", default=None, help="Optional output JSON file (array)")
    return parser


def to_float_or_none(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        numeric = float(value)
        if not math.isfinite(numeric):
            return None
        return numeric
    except Exception:
        return None


def normalize_isin(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = "".join(str(value).split()).upper()
    return normalized or None


def load_pairs_from_input(path: str) -> list[dict[str, Optional[str]]]:
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list):
        raise ValueError("--input muss ein JSON-Array sein.")

    pairs: list[dict[str, Optional[str]]] = []
    for row in payload:
        if not isinstance(row, dict):
            continue

        symbol = str(row.get("symbol", "")).strip().upper()
        if not symbol:
            continue

        pairs.append(
            {
                "isin": normalize_isin(row.get("isin")),
                "symbol": symbol,
                "meta": row,
            }
        )

    return pairs


def pick_history_series(history: Any, base_name: str):
    try:
        if base_name in history.columns:
            return history[base_name]
    except Exception:
        pass

    try:
        for column in history.columns:
            if isinstance(column, tuple):
                for part in column:
                    if str(part).strip().lower() == base_name.lower():
                        return history[column]
            elif str(column).strip().lower() == base_name.lower():
                return history[column]
    except Exception:
        pass

    return None


def get_last_valid_numeric(series: Any) -> Optional[float]:
    if series is None:
        return None

    try:
        cleaned = series.dropna()
    except Exception:
        return None

    if cleaned is None:
        return None

    try:
        iterable = cleaned.tolist()
    except Exception:
        try:
            iterable = list(cleaned)
        except Exception:
            return None

    for value in reversed(iterable):
        numeric = to_float_or_none(value)
        if numeric is not None:
            return numeric

    return None


def to_index_date(series_index_value: Any):
    try:
        value = series_index_value
        if hasattr(value, "tz_localize"):
            try:
                value = value.tz_localize(None)
            except Exception:
                pass
        if hasattr(value, "date"):
            return value.date()
    except Exception:
        return None

    return None


def filter_series_to_price_range(series: Any, first_date: str, last_date: str):
    if series is None:
        return None

    try:
        import pandas as pd

        start = pd.Timestamp(first_date).date()
        end = pd.Timestamp(last_date).date()

        idx_dates = series.index.to_series().apply(to_index_date)
        mask = idx_dates.notna() & (idx_dates >= start) & (idx_dates <= end)
        return series[mask]
    except Exception:
        return None


def count_non_zero_values(series: Any) -> int:
    if series is None:
        return 0

    try:
        cleaned = series.dropna()
    except Exception:
        return 0

    if cleaned is None or len(cleaned) == 0:
        return 0

    count = 0
    try:
        iterable = cleaned.tolist()
    except Exception:
        iterable = list(cleaned)

    for value in iterable:
        numeric = to_float_or_none(value)
        if numeric is not None and numeric != 0:
            count += 1

    return count


def sum_positive_values(series: Any) -> Optional[float]:
    if series is None:
        return None

    total = 0.0
    has_value = False

    try:
        cleaned = series.dropna()
    except Exception:
        return None

    try:
        iterable = cleaned.tolist()
    except Exception:
        iterable = list(cleaned)

    for value in iterable:
        numeric = to_float_or_none(value)
        if numeric is None:
            continue
        total += numeric
        has_value = True

    if not has_value:
        return None

    return round(total, 8)


def validate_symbol(*, yf, isin: Optional[str], symbol: str, period: str, with_actions: bool) -> dict[str, Any]:
    ticker = yf.Ticker(symbol)

    result: dict[str, Any] = {
        "isin": isin,
        "symbol": symbol,
        "hasHistory": False,
        "pointCount": 0,
        "firstDate": None,
        "lastDate": None,
        "latestClose": None,
        "latestCloseSource": None,
        "currency": None,
        "dividendsCount": 0,
        "splitsCount": 0,
        "dividendsAmountSum": None,
        "actionsScopedToPriceRange": False,
        "error": None,
    }

    try:
        history = ticker.history(period=period, interval="1d", auto_adjust=False, actions=False)
        if history is None or history.empty:
            return result

        result["pointCount"] = int(len(history))
        result["firstDate"] = history.index[0].strftime("%Y-%m-%d")
        result["lastDate"] = history.index[-1].strftime("%Y-%m-%d")

        close_series = pick_history_series(history, "Close")
        latest_close = get_last_valid_numeric(close_series)

        if latest_close is not None:
            result["latestClose"] = latest_close
            result["latestCloseSource"] = "Close"
            result["hasHistory"] = True
        else:
            adj_close_series = pick_history_series(history, "Adj Close")
            latest_adj_close = get_last_valid_numeric(adj_close_series)
            if latest_adj_close is not None:
                result["latestClose"] = latest_adj_close
                result["latestCloseSource"] = "Adj Close"
                result["hasHistory"] = True
            else:
                result["error"] = "No valid close values found"

        try:
            fast_info = getattr(ticker, "fast_info", None)
            if fast_info:
                result["currency"] = fast_info.get("currency")
        except Exception:
            pass

        if with_actions and result["firstDate"] and result["lastDate"]:
            result["actionsScopedToPriceRange"] = True

            dividends_total = 0
            splits_total = 0

            try:
                dividends = ticker.dividends
                if dividends is not None and not dividends.empty:
                    dividends_total = count_non_zero_values(dividends)
                    scoped_dividends = filter_series_to_price_range(dividends, result["firstDate"], result["lastDate"])
                    result["dividendsCount"] = count_non_zero_values(scoped_dividends)
                    result["dividendsAmountSum"] = sum_positive_values(scoped_dividends)
            except Exception:
                pass

            try:
                splits = ticker.splits
                if splits is not None and not splits.empty:
                    splits_total = count_non_zero_values(splits)
                    scoped_splits = filter_series_to_price_range(splits, result["firstDate"], result["lastDate"])
                    result["splitsCount"] = count_non_zero_values(scoped_splits)
            except Exception:
                pass

            result["dividendsTotalCount"] = dividends_total
            result["splitsTotalCount"] = splits_total

    except Exception as error:  # noqa: BLE001
        result["error"] = str(error)

    return result


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        import yfinance as yf
    except Exception:  # noqa: BLE001
        print("yfinance ist nicht installiert. Installiere es mit: python -m pip install yfinance")
        raise SystemExit(1)

    pairs: list[dict[str, Optional[str]]] = []

    if args.symbol:
        pairs.append({
            "isin": normalize_isin(args.isin),
            "symbol": str(args.symbol).strip().upper(),
            "meta": {
                "isin": normalize_isin(args.isin),
                "symbol": str(args.symbol).strip().upper(),
            },
        })

    if args.input:
        pairs.extend(load_pairs_from_input(args.input))

    if not pairs:
        print("Keine Validierungsziele angegeben. Nutze --symbol oder --input.")
        raise SystemExit(1)

    seen = set()
    deduped: list[dict[str, Optional[str]]] = []
    for pair in pairs:
        key = f"{pair.get('isin') or ''}|{pair['symbol']}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(pair)

    if args.limit is not None and args.limit > 0:
        deduped = deduped[: args.limit]

    all_results: list[dict[str, Any]] = []
    for pair in deduped:
        symbol = pair["symbol"]
        if not symbol:
            continue

        result = validate_symbol(
            yf=yf,
            isin=pair.get("isin"),
            symbol=symbol,
            period=args.period,
            with_actions=args.actions,
        )
        meta = pair.get("meta")
        if isinstance(meta, dict):
            merged = dict(meta)
            merged.update(result)
            result = merged
        print(json.dumps(result, ensure_ascii=False))
        all_results.append(result)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(all_results, handle, ensure_ascii=False, indent=2)
            handle.write("\n")


if __name__ == "__main__":
    main()

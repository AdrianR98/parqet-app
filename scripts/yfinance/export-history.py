#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def fail(message: str, exit_code: int = 1):
    print(message)
    raise SystemExit(exit_code)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export yfinance history and actions to JSON")
    parser.add_argument("--symbol", default="O")
    parser.add_argument("--isin", default="US7561091049")
    parser.add_argument("--name", default="Realty Income")
    parser.add_argument("--out", required=True)
    parser.add_argument("--period", default="max")
    parser.add_argument("--start", default=None)
    parser.add_argument("--end", default=None)
    return parser


def to_float_or_none(value):
    try:
        if value is None:
            return None
        numeric = float(value)
        if numeric != numeric:
            return None
        return numeric
    except Exception:
        return None


def to_int_or_none(value):
    try:
        if value is None:
            return None
        numeric = int(value)
        return numeric
    except Exception:
        return None


def parse_iso_date_or_none(value: str | None) -> str | None:
    if value is None:
        return None

    raw = str(value).strip()
    if not raw:
        return None

    try:
        parsed = datetime.strptime(raw, "%Y-%m-%d")
    except ValueError:
        fail(f"Ungültiges Datum: {raw}. Erwartet YYYY-MM-DD")

    return parsed.strftime("%Y-%m-%d")


def is_in_date_window(date_str: str, start_date: str | None, end_date: str | None) -> bool:
    if start_date is not None and date_str < start_date:
        return False
    if end_date is not None and date_str > end_date:
        return False
    return True


def main():
    parser = build_parser()
    args = parser.parse_args()

    start_date = parse_iso_date_or_none(args.start)
    end_date = parse_iso_date_or_none(args.end)
    if start_date and end_date and start_date > end_date:
        fail("--start darf nicht nach --end liegen.")

    try:
        import yfinance as yf
    except Exception:
        fail("yfinance ist nicht installiert. Installiere es mit: python -m pip install yfinance")

    ticker = yf.Ticker(args.symbol)

    history_kwargs = {
        "interval": "1d",
        "auto_adjust": False,
        "actions": False,
    }

    if start_date or end_date:
        history_kwargs["start"] = start_date
        if end_date:
            history_kwargs["end"] = end_date
    else:
        history_kwargs["period"] = args.period

    history = ticker.history(**history_kwargs)
    if history is None or history.empty:
        fail("Keine Historie von yfinance erhalten.")

    info_currency = None
    exchange = None
    try:
        fast_info = getattr(ticker, "fast_info", None)
        if fast_info:
            info_currency = fast_info.get("currency")
            exchange = fast_info.get("exchange")
    except Exception:
        pass

    prices = []
    for idx, row in history.iterrows():
        prices.append(
            {
                "date": idx.strftime("%Y-%m-%d"),
                "open": to_float_or_none(row.get("Open")),
                "high": to_float_or_none(row.get("High")),
                "low": to_float_or_none(row.get("Low")),
                "close": to_float_or_none(row.get("Close")),
                "adjClose": to_float_or_none(row.get("Adj Close")),
                "volume": to_int_or_none(row.get("Volume")),
                "currency": info_currency,
            }
        )

    actions = []
    try:
        dividends = ticker.dividends
        if dividends is not None and not dividends.empty:
            for idx, value in dividends.items():
                action_date = idx.strftime("%Y-%m-%d")
                if is_in_date_window(action_date, start_date, end_date):
                    actions.append(
                        {
                            "actionType": "dividend",
                            "date": action_date,
                            "amount": to_float_or_none(value),
                            "currency": info_currency,
                        }
                    )
    except Exception:
        pass

    try:
        splits = ticker.splits
        if splits is not None and not splits.empty:
            for idx, value in splits.items():
                action_date = idx.strftime("%Y-%m-%d")
                if is_in_date_window(action_date, start_date, end_date):
                    ratio = to_float_or_none(value)
                    actions.append(
                        {
                            "actionType": "split",
                            "date": action_date,
                            "ratio": str(ratio) if ratio is not None else None,
                        }
                    )
    except Exception:
        pass

    payload = {
        "instrument": {
            "isin": args.isin,
            "name": args.name,
            "assetType": "equity",
            "currency": info_currency,
        },
        "mapping": {
            "provider": "yfinance",
            "symbol": args.symbol,
            "exchange": exchange or "NYSE",
            "currency": info_currency,
        },
        "prices": prices,
        "actions": actions,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "source": "yfinance",
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Export abgeschlossen: {out_path}")
    print(f"Preise: {len(prices)}")
    print(f"Actions: {len(actions)}")


if __name__ == "__main__":
    main()

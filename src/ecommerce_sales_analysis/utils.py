def format_large_number(num):
    """Formats large numbers into K or M strings."""
    if num >= 1_000_000:
        return f"{num / 1_000_000:.1f}"
    elif num >= 1_000:
        return f"{num / 1_000:.1f}"
    else:
        return f"{num:,.0f}"

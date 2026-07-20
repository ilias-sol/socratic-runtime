def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    ordered = sorted((start, end) for start, end in intervals)
    merged: list[list[int]] = []
    for start, end in ordered:
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return merged

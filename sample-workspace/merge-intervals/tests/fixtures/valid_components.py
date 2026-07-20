def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:
    remaining = [item[:] for item in intervals]
    groups: list[list[int]] = []
    while remaining:
        start, end = remaining.pop()
        changed = True
        while changed:
            changed = False
            kept = []
            for other_start, other_end in remaining:
                if other_start <= end and start <= other_end:
                    start = min(start, other_start)
                    end = max(end, other_end)
                    changed = True
                else:
                    kept.append([other_start, other_end])
            remaining = kept
        groups.append([start, end])
    return sorted(groups)

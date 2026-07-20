def binary_search(values: list[int], target: int) -> int:
    low = 0
    high = len(values)
    while low < high:
        midpoint = low + (high - low) // 2
        if values[midpoint] < target:
            low = midpoint + 1
        elif values[midpoint] > target:
            high = midpoint
        else:
            return midpoint
    return -1

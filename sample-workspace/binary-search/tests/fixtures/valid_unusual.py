def binary_search(values: list[int], target: int) -> int:
    offset = 0
    window = values
    while window:
        middle = len(window) // 2
        probe = window[middle]
        if probe == target:
            return offset + middle
        if probe < target:
            offset += middle + 1
            window = window[middle + 1 :]
        else:
            window = window[:middle]
    return -1

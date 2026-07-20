"""
@socratic-task

Implement binary search over a sorted list.

Requirements:
- Return a matching index.
- Return -1 when the target is absent.
- Handle empty and one-element lists.
- Do not use list.index().
- Aim for logarithmic time.
"""


def binary_search(values: list[int], target: int) -> int:
    low = 0
    high = len(values)
    while low < high:
        middle = low + (high - low) // 2
        if values[middle] < target:
            low = middle + 1
        else:
            high = middle
    if low < len(values) and values[low] == target:
        return low
    return -1

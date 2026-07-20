from __future__ import annotations

import random

import pytest


def oracle(intervals: list[list[int]]) -> list[list[int]]:
    result: list[list[int]] = []
    for start, end in sorted(intervals):
        if not result or start > result[-1][1]:
            result.append([start, end])
        else:
            result[-1][1] = max(result[-1][1], end)
    return result


@pytest.mark.timeout(1)
@pytest.mark.parametrize(
    ("intervals", "expected"),
    [
        ([], []),
        ([[1, 4]], [[1, 4]]),
        ([[1, 3], [2, 6], [8, 10], [15, 18]], [[1, 6], [8, 10], [15, 18]]),
        ([[1, 4], [4, 5]], [[1, 5]]),
        ([[5, 7], [1, 10], [2, 3]], [[1, 10]]),
        ([[-5, -1], [-3, 2], [8, 8]], [[-5, 2], [8, 8]]),
        ([[1, 2], [1, 2], [1, 2]], [[1, 2]]),
    ],
)
def test_examples(merge_intervals, intervals, expected):
    assert merge_intervals(intervals) == expected


@pytest.mark.timeout(1)
def test_does_not_mutate_nested_input(merge_intervals):
    intervals = [[5, 8], [1, 3], [2, 6]]
    original = [item[:] for item in intervals]
    merge_intervals(intervals)
    assert intervals == original


@pytest.mark.timeout(2)
def test_deterministic_generated_cases(merge_intervals):
    generator = random.Random(20260718)
    for _ in range(120):
        intervals = []
        for _ in range(generator.randrange(0, 45)):
            start = generator.randrange(-100, 100)
            intervals.append([start, start + generator.randrange(0, 20)])
        original = [item[:] for item in intervals]
        assert merge_intervals(intervals) == oracle(intervals)
        assert intervals == original

from __future__ import annotations

import random
from collections import deque

import pytest


def oracle(grid: list[list[str]]) -> int:
    if not grid:
        return 0
    seen: set[tuple[int, int]] = set()
    count = 0
    for row in range(len(grid)):
        for column in range(len(grid[0])):
            if grid[row][column] != "1" or (row, column) in seen:
                continue
            count += 1
            queue = deque([(row, column)])
            seen.add((row, column))
            while queue:
                current_row, current_column = queue.popleft()
                for next_row, next_column in (
                    (current_row - 1, current_column),
                    (current_row + 1, current_column),
                    (current_row, current_column - 1),
                    (current_row, current_column + 1),
                ):
                    if (
                        0 <= next_row < len(grid)
                        and 0 <= next_column < len(grid[0])
                        and grid[next_row][next_column] == "1"
                        and (next_row, next_column) not in seen
                    ):
                        seen.add((next_row, next_column))
                        queue.append((next_row, next_column))
    return count


@pytest.mark.timeout(1)
@pytest.mark.parametrize(
    ("grid", "expected"),
    [
        ([], 0),
        ([["0"]], 0),
        ([["1"]], 1),
        ([list("110"), list("010"), list("001")], 2),
        ([list("101"), list("010"), list("101")], 5),
        ([list("11110"), list("11010"), list("11000"), list("00000")], 1),
    ],
)
def test_examples(num_islands, grid, expected):
    original = [row[:] for row in grid]
    assert num_islands(grid) == expected
    assert grid == original


@pytest.mark.timeout(2)
def test_long_connected_region_is_iterative_safe(num_islands):
    grid = [list("1" * 2500)]
    assert num_islands(grid) == 1
    assert grid == [list("1" * 2500)]


@pytest.mark.timeout(2)
def test_deterministic_generated_grids(num_islands):
    generator = random.Random(20260718)
    for _ in range(80):
        height = generator.randrange(1, 18)
        width = generator.randrange(1, 18)
        grid = [
            [generator.choice(("0", "0", "1")) for _ in range(width)]
            for _ in range(height)
        ]
        original = [row[:] for row in grid]
        assert num_islands(grid) == oracle(grid)
        assert grid == original

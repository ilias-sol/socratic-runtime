from collections import deque


def num_islands(grid: list[list[str]]) -> int:
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
                for point in (
                    (current_row - 1, current_column),
                    (current_row + 1, current_column),
                    (current_row, current_column - 1),
                    (current_row, current_column + 1),
                ):
                    next_row, next_column = point
                    if (
                        0 <= next_row < len(grid)
                        and 0 <= next_column < len(grid[0])
                        and grid[next_row][next_column] == "1"
                        and point not in seen
                    ):
                        seen.add(point)
                        queue.append(point)
    return count

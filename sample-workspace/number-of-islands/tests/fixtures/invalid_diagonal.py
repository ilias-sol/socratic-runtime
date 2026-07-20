def num_islands(grid: list[list[str]]) -> int:
    if not grid:
        return 0
    seen = set()
    count = 0
    for row in range(len(grid)):
        for column in range(len(grid[0])):
            if grid[row][column] != "1" or (row, column) in seen:
                continue
            count += 1
            stack = [(row, column)]
            seen.add((row, column))
            while stack:
                current_row, current_column = stack.pop()
                for row_delta in (-1, 0, 1):
                    for column_delta in (-1, 0, 1):
                        point = current_row + row_delta, current_column + column_delta
                        if (
                            0 <= point[0] < len(grid)
                            and 0 <= point[1] < len(grid[0])
                            and grid[point[0]][point[1]] == "1"
                            and point not in seen
                        ):
                            seen.add(point)
                            stack.append(point)
    return count

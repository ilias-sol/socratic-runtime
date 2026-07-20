def num_islands(grid: list[list[str]]) -> int:
    if not grid:
        return 0
    width = len(grid[0])
    land = {
        row * width + column
        for row in range(len(grid))
        for column in range(width)
        if grid[row][column] == "1"
    }
    parent = {cell: cell for cell in land}

    def find(cell: int) -> int:
        while parent[cell] != cell:
            parent[cell] = parent[parent[cell]]
            cell = parent[cell]
        return cell

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for cell in land:
        row, column = divmod(cell, width)
        if column + 1 < width and cell + 1 in land:
            union(cell, cell + 1)
        if row + 1 < len(grid) and cell + width in land:
            union(cell, cell + width)
    return len({find(cell) for cell in land})

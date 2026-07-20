class Node:
    def __init__(self, key: int = 0, value: int = 0):
        self.key = key
        self.value = value
        self.previous = None
        self.next = None


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.nodes = {}
        self.oldest = Node()
        self.newest = Node()
        self.oldest.next = self.newest
        self.newest.previous = self.oldest

    def _remove(self, node: Node) -> None:
        node.previous.next = node.next
        node.next.previous = node.previous

    def _append(self, node: Node) -> None:
        node.previous = self.newest.previous
        node.next = self.newest
        self.newest.previous.next = node
        self.newest.previous = node

    def get(self, key: int) -> int:
        if key not in self.nodes:
            return -1
        node = self.nodes[key]
        self._remove(node)
        self._append(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        if key in self.nodes:
            self._remove(self.nodes[key])
        node = Node(key, value)
        self.nodes[key] = node
        self._append(node)
        if len(self.nodes) > self.capacity:
            evicted = self.oldest.next
            self._remove(evicted)
            del self.nodes[evicted.key]

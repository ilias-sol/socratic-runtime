from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.values = OrderedDict()

    def get(self, key: int) -> int:
        return self.values.get(key, -1)

    def put(self, key: int, value: int) -> None:
        self.values[key] = value
        if len(self.values) > self.capacity:
            self.values.popitem(last=False)

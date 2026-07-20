from __future__ import annotations

import random
from collections import OrderedDict

import pytest


class Oracle:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.values: OrderedDict[int, int] = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.values:
            return -1
        self.values.move_to_end(key)
        return self.values[key]

    def put(self, key: int, value: int) -> None:
        if key in self.values:
            self.values.move_to_end(key)
        self.values[key] = value
        if len(self.values) > self.capacity:
            self.values.popitem(last=False)


@pytest.mark.timeout(1)
def test_canonical_sequence(cache_class):
    cache = cache_class(2)
    cache.put(1, 1)
    cache.put(2, 2)
    assert cache.get(1) == 1
    cache.put(3, 3)
    assert cache.get(2) == -1
    cache.put(4, 4)
    assert cache.get(1) == -1
    assert cache.get(3) == 3
    assert cache.get(4) == 4


@pytest.mark.timeout(1)
def test_update_and_read_refresh_recency(cache_class):
    cache = cache_class(2)
    cache.put(1, 10)
    cache.put(2, 20)
    cache.put(1, 11)
    cache.put(3, 30)
    assert cache.get(1) == 11
    assert cache.get(2) == -1
    assert cache.get(3) == 30


@pytest.mark.timeout(1)
def test_capacity_one(cache_class):
    cache = cache_class(1)
    cache.put(7, 70)
    assert cache.get(7) == 70
    cache.put(8, 80)
    assert cache.get(7) == -1
    assert cache.get(8) == 80


@pytest.mark.timeout(3)
def test_long_deterministic_operation_stream(cache_class):
    generator = random.Random(20260718)
    for capacity in (1, 2, 7, 31):
        actual = cache_class(capacity)
        expected = Oracle(capacity)
        for _ in range(3000):
            key = generator.randrange(80)
            if generator.random() < 0.58:
                value = generator.randrange(-10000, 10000)
                actual.put(key, value)
                expected.put(key, value)
            else:
                assert actual.get(key) == expected.get(key)

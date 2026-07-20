import pytest


@pytest.mark.timeout(1)
@pytest.mark.parametrize(
    ("values", "target", "expected"),
    [
        ([], 4, -1),
        ([4], 4, 0),
        ([4], 3, -1),
        ([1, 3, 5, 7, 9], 1, 0),
        ([1, 3, 5, 7, 9], 9, 4),
        ([1, 3, 5, 7, 9], 5, 2),
        ([1, 3, 5, 7, 9], 6, -1),
    ],
)
def test_public_cases(binary_search, values, target, expected):
    result = binary_search(values, target)
    if expected == -1:
        assert result == -1
    else:
        assert result == expected


@pytest.mark.timeout(1)
def test_duplicate_value_may_return_any_matching_index(binary_search):
    values = [1, 2, 2, 2, 3]
    result = binary_search(values, 2)
    assert 0 <= result < len(values)
    assert values[result] == 2


@pytest.mark.timeout(1)
def test_does_not_use_list_index(binary_search):
    class NoIndexList(list):
        def index(self, *_args, **_kwargs):
            raise AssertionError("list.index() is forbidden")

    assert binary_search(NoIndexList([1, 3, 5]), 3) == 1

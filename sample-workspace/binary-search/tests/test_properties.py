import pytest
from hypothesis import given, settings, strategies as st


@pytest.mark.timeout(2)
@settings(max_examples=40, deadline=500)
@given(
    values=st.lists(st.integers(min_value=-500, max_value=500), max_size=80, unique=True).map(sorted),
    target=st.integers(min_value=-600, max_value=600),
)
def test_generated_sorted_lists(binary_search, values, target):
    result = binary_search(values, target)
    if target in values:
        assert 0 <= result < len(values)
        assert values[result] == target
    else:
        assert result == -1


@pytest.mark.timeout(2)
@settings(max_examples=25, deadline=500)
@given(values=st.lists(st.integers(min_value=-20, max_value=20), min_size=1, max_size=60).map(sorted))
def test_every_present_value_is_findable(binary_search, values):
    target = values[len(values) // 2]
    result = binary_search(values, target)
    assert 0 <= result < len(values)
    assert values[result] == target

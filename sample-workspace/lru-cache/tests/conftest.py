from __future__ import annotations

import importlib.util
import os
from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def cache_class():
    default = Path(__file__).parents[1] / "solution.py"
    source = Path(os.environ.get("SOCRATIC_SOLUTION", default))
    spec = importlib.util.spec_from_file_location("socratic_candidate", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load candidate: {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.LRUCache

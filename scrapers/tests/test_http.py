import requests

from shared.http import make_session


def test_make_session_returns_a_session():
    assert isinstance(make_session(), requests.Session)


def test_make_session_mounts_retry_adapters_on_both_schemes():
    session = make_session()
    for prefix in ("https://", "http://"):
        adapter = session.get_adapter(prefix)
        retry = adapter.max_retries
        assert retry.total == 3
        assert 429 in retry.status_forcelist
        assert 503 in retry.status_forcelist

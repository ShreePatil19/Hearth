import pytest
import requests

from shared.http import (
    MAX_RESPONSE_BYTES,
    ResponseTooLargeError,
    _enforce_max_size,
    make_session,
)


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


def test_make_session_registers_response_size_hook():
    session = make_session()
    assert _enforce_max_size in session.hooks["response"]


def _response(body, content_length):
    resp = requests.Response()
    resp.url = "https://example.com/page"
    resp._content = body
    if content_length is not None:
        resp.headers["Content-Length"] = content_length
    return resp


def test_size_cap_rejects_oversized_declared_length():
    resp = _response(b"x", str(MAX_RESPONSE_BYTES + 1))
    with pytest.raises(ResponseTooLargeError):
        _enforce_max_size(resp)


def test_size_cap_rejects_oversized_body_without_header():
    resp = _response(b"x" * (MAX_RESPONSE_BYTES + 1), None)
    with pytest.raises(ResponseTooLargeError):
        _enforce_max_size(resp)


def test_size_cap_allows_normal_response():
    resp = _response(b"<html>ok</html>", "15")
    assert _enforce_max_size(resp) is resp

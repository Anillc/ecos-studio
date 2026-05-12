import importlib
import logging


def test_api_logger_writes_plain_records_to_file(tmp_path, monkeypatch):
    log_file = tmp_path / "api-server.log"
    monkeypatch.setenv("ECOS_API_LOG_FILE", str(log_file))
    monkeypatch.setenv("ECOS_API_LOG_LEVEL", "debug")

    log_module = importlib.import_module("ecos_server._log")
    logger = log_module.ensure_api_logger(reset=True)

    logger.debug("[API_PHASE] process_started")
    logger.warning("[API_WARN] ready took longer than expected")

    content = log_file.read_text()
    assert "[API_PHASE] process_started" in content
    assert "[API_WARN] ready took longer than expected" in content
    assert "\x1b[" not in content

    for handler in list(logger.handlers):
        handler.close()
        logger.removeHandler(handler)
    logger.setLevel(logging.NOTSET)

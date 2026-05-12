import logging
import os
import sys
from logging.handlers import RotatingFileHandler


def _remove_handlers(log: logging.Logger) -> None:
    for handler in list(log.handlers):
        log.removeHandler(handler)
        handler.close()


def ensure_api_logger(reset: bool = False) -> logging.Logger:
    log = logging.getLogger("ecos.api")
    if reset:
        _remove_handlers(log)

    if not log.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(message)s"))
        log.addHandler(handler)

        log_file = os.environ.get("ECOS_API_LOG_FILE", "").strip()
        if log_file:
            os.makedirs(os.path.dirname(os.path.abspath(log_file)), exist_ok=True)
            file_handler = RotatingFileHandler(
                log_file,
                maxBytes=20 * 1024 * 1024,
                backupCount=5,
                encoding="utf-8",
            )
            file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
            log.addHandler(file_handler)

        log.propagate = False
        level = os.environ.get("ECOS_API_LOG_LEVEL", "warning").upper()
        try:
            log.setLevel(level)
        except ValueError:
            log.setLevel(logging.WARNING)
    return log

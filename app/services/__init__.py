# Lazy package — submodules (document_processor, evaluation_engine,
# report_generator) pull in heavy deps (PaddleOCR, WeasyPrint, etc.).
# Import them explicitly where needed instead of at package import time.

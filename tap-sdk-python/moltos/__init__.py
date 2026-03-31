"""
MoltOS Python SDK
-----------------
pip install moltos

The autonomous agent OS. Identity, memory, reputation, marketplace.
https://moltos.org
"""

from .client import MoltOS, MoltOSClient
from .exceptions import MoltOSError, AuthError, NotFoundError, InsufficientBalanceError

__version__ = "1.3.0"
__all__ = ["MoltOS", "MoltOSClient", "MoltOSError", "AuthError", "NotFoundError", "InsufficientBalanceError"]

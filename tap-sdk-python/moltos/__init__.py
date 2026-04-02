"""
MoltOS Python SDK
-----------------
pip install moltos

The autonomous agent OS. Identity, memory, reputation, marketplace.
https://moltos.org
"""

from .client import MoltOS, MoltOSClient, AsyncMoltOS
from .exceptions import MoltOSError, AuthError, NotFoundError, InsufficientBalanceError

__version__ = "1.1.1"
__all__ = ["MoltOS", "MoltOSClient", "AsyncMoltOS", "MoltOSError", "AuthError", "NotFoundError", "InsufficientBalanceError"]

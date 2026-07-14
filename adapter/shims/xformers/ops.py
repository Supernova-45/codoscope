"""Fail-fast shim for symbols imported by DeCodon's public modeling file."""


class LowerTriangularMask:
    def __init__(self, *_args, **_kwargs):
        raise RuntimeError(
            "xFormers attention was requested in Codoscope's CPU runtime. "
            "Set config.use_flash_attn=False."
        )


def memory_efficient_attention(*_args, **_kwargs):
    raise RuntimeError(
        "xFormers attention was requested in Codoscope's CPU runtime. "
        "Set config.use_flash_attn=False."
    )

"""Create the pinned analysis environment without relaxing DeCodon versions."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

JLENS_COMMIT = "581d398613e5602a5af361e1c34d3a92ea82ba8e"
ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "-r",
            str(ROOT / "backend" / "requirements.txt"),
        ],
        check=True,
    )
    # jlens declares Transformers >=5.5 for its generic Hugging Face adapter.
    # Codoscope implements LensModel directly and needs DeCodon's tested
    # Transformers 4.44.2 runtime, so install the pinned jlens code without its
    # unrelated adapter dependency.
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--no-deps",
            (
                "git+https://github.com/anthropics/jacobian-lens.git"
                f"@{JLENS_COMMIT}"
            ),
        ],
        check=True,
    )


if __name__ == "__main__":
    main()

"""Biology-aware validation for DeCodon coding-sequence inputs."""

from __future__ import annotations

from dataclasses import dataclass

MIN_CODONS = 20
MAX_CODONS = 512
STOP_CODONS = frozenset(("TAA", "TAG", "TGA"))


@dataclass(frozen=True)
class ValidatedCDS:
    sequence: str
    codons: tuple[str, ...]
    terminal_stop_removed: bool


class CDSValidationError(ValueError):
    """Raised when a sequence is not a biologically valid CDS."""


def validate_cds(sequence: str) -> ValidatedCDS:
    normalized = "".join(sequence.split()).upper()
    if not normalized:
        raise CDSValidationError("Empty sequence")
    if not all(base in "ACGT" for base in normalized):
        raise CDSValidationError("Sequence must contain only A, C, G, T")
    if len(normalized) % 3:
        raise CDSValidationError(
            f"Length {len(normalized)} is not divisible by 3"
        )
    if not normalized.startswith("ATG"):
        raise CDSValidationError("CDS must start with ATG (start codon)")

    codons = tuple(
        normalized[index : index + 3]
        for index in range(0, len(normalized), 3)
    )
    terminal_stop_removed = bool(codons and codons[-1] in STOP_CODONS)
    coding_codons = codons[:-1] if terminal_stop_removed else codons

    internal_stops = [
        index for index, codon in enumerate(coding_codons)
        if codon in STOP_CODONS
    ]
    if internal_stops:
        positions = ", ".join(str(position) for position in internal_stops)
        raise CDSValidationError(f"Internal stop codon at position(s): {positions}")
    if len(coding_codons) < MIN_CODONS:
        raise CDSValidationError(
            f"Sequence must contain at least {MIN_CODONS} coding codons"
        )
    if len(coding_codons) > MAX_CODONS:
        raise CDSValidationError(
            f"Maximum {MAX_CODONS} coding codons per request"
        )

    return ValidatedCDS(
        sequence="".join(coding_codons),
        codons=coding_codons,
        terminal_stop_removed=terminal_stop_removed,
    )

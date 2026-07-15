#!/usr/bin/env python3
"""Extract one VFCS custom chip and its nested chip dependencies.

Examples:
  python tools/extract-chip-subtree.py library.json arithmatic_unit -o aru-subtree.json
  python tools/extract-chip-subtree.py library.json "ARITHMATIC UNIT" --dry-run
  python tools/extract-chip-subtree.py library.json --list
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


JsonObject = dict[str, Any]


def load_chips(path: Path) -> list[JsonObject]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc

    candidates = payload if isinstance(payload, list) else [payload]
    chips: list[JsonObject] = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        chip_id = candidate.get("id")
        internal_circuit = candidate.get("internalCircuit")
        if isinstance(chip_id, str) and isinstance(internal_circuit, dict):
            chips.append(candidate)

    if not chips:
        raise SystemExit(f"No chip definitions found in {path}.")

    return chips


def chip_label(chip: JsonObject) -> str:
    chip_id = chip.get("id", "(missing id)")
    name = chip.get("name", "(unnamed)")
    return f"{chip_id} ({name})"


def find_chip(query: str, chips_by_id: dict[str, JsonObject], chips: list[JsonObject]) -> JsonObject:
    direct = chips_by_id.get(query)
    if direct is not None:
        return direct

    lowered = query.casefold()
    matches = [
        chip
        for chip in chips
        if isinstance(chip.get("name"), str) and chip["name"].casefold() == lowered
    ]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        labels = "\n  ".join(chip_label(chip) for chip in matches)
        raise SystemExit(f'Chip name "{query}" is ambiguous. Matching chips:\n  {labels}')

    similar = [
        chip
        for chip in chips
        if lowered in str(chip.get("id", "")).casefold()
        or lowered in str(chip.get("name", "")).casefold()
    ][:12]
    hint = ""
    if similar:
        hint = "\nSimilar chips:\n  " + "\n  ".join(chip_label(chip) for chip in similar)
    raise SystemExit(f'Chip "{query}" was not found by id or exact name.{hint}')


def nested_chip_refs(chip: JsonObject) -> list[str]:
    circuit = chip.get("internalCircuit")
    if not isinstance(circuit, dict):
        return []

    nodes = circuit.get("nodes")
    if not isinstance(nodes, list):
        return []

    refs: list[str] = []
    seen: set[str] = set()
    for node in nodes:
        if not isinstance(node, dict):
            continue
        if node.get("nodeType") != "CHIP":
            continue
        chip_ref_id = node.get("chipRefId")
        if isinstance(chip_ref_id, str) and chip_ref_id and chip_ref_id not in seen:
            refs.append(chip_ref_id)
            seen.add(chip_ref_id)

    return refs


def collect_dependency_ids(
    root_chip: JsonObject,
    chips_by_id: dict[str, JsonObject],
    include_deps: bool,
) -> tuple[list[str], list[str]]:
    root_id = str(root_chip["id"])
    ordered: list[str] = []
    missing: list[str] = []
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(chip_id: str) -> None:
        if chip_id in visited:
            return
        if chip_id in visiting:
            return

        chip = chips_by_id.get(chip_id)
        if chip is None:
            if chip_id not in missing:
                missing.append(chip_id)
            return

        visiting.add(chip_id)
        if include_deps:
            for ref_id in nested_chip_refs(chip):
                visit(ref_id)
        visiting.remove(chip_id)

        visited.add(chip_id)
        ordered.append(chip_id)

    visit(root_id)
    return ordered, missing


def order_chips(
    selected_ids: list[str],
    chips: list[JsonObject],
    chips_by_id: dict[str, JsonObject],
    order: str,
) -> list[JsonObject]:
    selected_set = set(selected_ids)
    if order == "dependency-first":
        return [chips_by_id[chip_id] for chip_id in selected_ids]
    if order == "target-first":
        return [chips_by_id[chip_id] for chip_id in reversed(selected_ids)]
    if order == "source":
        return [chip for chip in chips if chip.get("id") in selected_set]
    raise AssertionError(f"Unhandled order: {order}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Extract one VFCS custom chip and recursively include nested CHIP dependencies.",
    )
    parser.add_argument("library", type=Path, help="Chip library JSON file to read.")
    parser.add_argument(
        "chip",
        nargs="?",
        help="Target chip id, or exact chip name if the id is not known.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output JSON path. Defaults to <chip-id>-subtree.json beside the input file.",
    )
    parser.add_argument(
        "--no-deps",
        action="store_true",
        help="Only extract the requested chip; do not include nested chip dependencies.",
    )
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Write the output even if nested chipRefId dependencies are missing from the source library.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be extracted without writing a file.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List chips in the source library and exit.",
    )
    parser.add_argument(
        "--order",
        choices=("dependency-first", "target-first", "source"),
        default="dependency-first",
        help="Ordering for the output array. Default: dependency-first.",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Write compact JSON instead of pretty-printed JSON.",
    )
    return parser


def main(argv: list[str]) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    chips = load_chips(args.library)
    chips_by_id = {str(chip["id"]): chip for chip in chips}

    if args.list:
        for chip in chips:
            refs = nested_chip_refs(chip)
            suffix = f" -> {', '.join(refs)}" if refs else ""
            print(f"{chip_label(chip)}{suffix}")
        return 0

    if not args.chip:
        parser.error("chip is required unless --list is used")

    root_chip = find_chip(args.chip, chips_by_id, chips)
    selected_ids, missing = collect_dependency_ids(
        root_chip,
        chips_by_id,
        include_deps=not args.no_deps,
    )
    selected_chips = order_chips(selected_ids, chips, chips_by_id, args.order)

    print(f"Target: {chip_label(root_chip)}")
    print(f"Selected {len(selected_chips)} chip(s):")
    for chip in selected_chips:
        refs = nested_chip_refs(chip)
        suffix = f" uses [{', '.join(refs)}]" if refs else ""
        print(f"  - {chip_label(chip)}{suffix}")

    if missing:
        print("\nMissing nested chipRefId(s):", file=sys.stderr)
        for chip_id in missing:
            print(f"  - {chip_id}", file=sys.stderr)
        if not args.allow_missing:
            print("\nUse --allow-missing to write anyway.", file=sys.stderr)
            return 1

    if args.dry_run:
        return 0

    output_path = args.output
    if output_path is None:
        safe_id = "".join(
            char if char.isalnum() or char in ("-", "_") else "_"
            for char in str(root_chip["id"])
        )
        output_path = args.library.with_name(f"{safe_id}-subtree.json")

    if args.compact:
        json_text = json.dumps(selected_chips, separators=(",", ":"))
    else:
        json_text = json.dumps(selected_chips, indent=2)
    output_path.write_text(json_text + "\n", encoding="utf-8")
    print(f"\nWrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
